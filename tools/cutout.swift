// Cuts a head or a pointing hand out of a photo with macOS Vision (macOS 14+)
// and prints the numbers talk.js needs.
//
//   swift tools/cutout.swift head photo.jpg media/head.png
//   swift tools/cutout.swift hand photo.jpg media/hand.png
//
// Head: straight-on, mouth closed, face filling most of the frame.
// Hand: index finger pointing, whole hand in frame, plain background.

import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 4, args[1] == "head" || args[1] == "hand" else {
  fail("usage: swift tools/cutout.swift head|hand <photo> <out.png>")
}
let mode = args[1]
let inURL = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

let ctx = CIContext()
guard let src = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else {
  fail("can't read \(inURL.path)")
}
let image = src.transformed(by: CGAffineTransform(translationX: -src.extent.minX, y: -src.extent.minY))
guard let cg = ctx.createCGImage(image, from: image.extent) else { fail("can't decode image") }
let W = CGFloat(cg.width), H = CGFloat(cg.height)
let handler = VNImageRequestHandler(cgImage: cg)

// Subject lift: same model as "Copy Subject" in Photos.
let maskReq = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([maskReq])
guard let maskObs = maskReq.results?.first else { fail("no subject found") }
let maskBuf = try maskObs.generateScaledMaskForImage(forInstances: maskObs.allInstances, from: handler)
let cut = image.applyingFilter("CIBlendWithMask", parameters: [
  kCIInputBackgroundImageKey: CIImage.empty(),
  kCIInputMaskImageKey: CIImage(cvPixelBuffer: maskBuf),
])

// Vision and Core Image use a bottom-left origin. Everything below stays in
// that space until the final fractions, which are top-left like the browser.
var crop: CGRect
var extras: [String: Any] = [:]

if mode == "head" {
  let faceReq = VNDetectFaceLandmarksRequest()
  try handler.perform([faceReq])
  if let face = faceReq.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }),
     let inner = face.landmarks?.innerLips ?? face.landmarks?.outerLips,
     let outer = face.landmarks?.outerLips ?? face.landmarks?.innerLips {
    let size = CGSize(width: W, height: H)
    let innerPts = inner.pointsInImage(imageSize: size)
    let outerPts = outer.pointsInImage(imageSize: size)
    let fb = CGRect(x: face.boundingBox.minX * W, y: face.boundingBox.minY * H,
                    width: face.boundingBox.width * W, height: face.boundingBox.height * H)
    // Generous box for hair and ears, cut flat just under the chin.
    crop = CGRect(x: fb.minX - fb.width * 0.45, y: fb.minY - fb.height * 0.06,
                  width: fb.width * 1.9, height: fb.height * 1.9)
    extras["mouthY"] = innerPts.map(\.y).reduce(0, +) / CGFloat(innerPts.count)
    extras["mouthX0"] = outerPts.map(\.x).min()!
    extras["mouthX1"] = outerPts.map(\.x).max()!
  } else {
    // Filters, sunglasses or odd angles can hide the face. Crop the photo to
    // the head yourself first, then set the mouth line by eye in talk.js.
    FileHandle.standardError.write("warning: no face found, guessing the mouth line\n".data(using: .utf8)!)
    crop = image.extent
  }
} else {
  crop = image.extent
  let handReq = VNDetectHumanHandPoseRequest()
  handReq.maximumHandCount = 1
  try handler.perform([handReq])
  if let hand = handReq.results?.first,
     let tip = try? hand.recognizedPoint(.indexTip), tip.confidence > 0.3,
     let base = try? hand.recognizedPoint(.indexMCP), base.confidence > 0.3 {
    extras["tip"] = CGPoint(x: tip.location.x * W, y: tip.location.y * H)
    extras["base"] = CGPoint(x: base.location.x * W, y: base.location.y * H)
  } else {
    FileHandle.standardError.write("warning: no hand pose found, guessing the fingertip is the top\n".data(using: .utf8)!)
  }
}

crop = crop.intersection(image.extent).integral
guard let croppedCG = ctx.createCGImage(cut, from: crop) else { fail("crop failed") }

// Trim fully transparent margins so the PNG hugs the subject.
let cw = croppedCG.width, ch = croppedCG.height
var px = [UInt8](repeating: 0, count: cw * ch * 4)
let bctx = CGContext(data: &px, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw * 4,
                     space: CGColorSpaceCreateDeviceRGB(),
                     bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
bctx.draw(croppedCG, in: CGRect(x: 0, y: 0, width: cw, height: ch))
var minX = cw, minY = ch, maxX = -1, maxY = -1  // bitmap rows run top to bottom
for y in 0..<ch {
  for x in 0..<cw where px[(y * cw + x) * 4 + 3] > 24 {
    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
  }
}
guard maxX >= minX else { fail("subject mask is empty") }
let tight = (minX: minX, minY: minY, rect: CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1))
guard let trimmed = croppedCG.cropping(to: tight.rect) else { fail("trim failed") }

// Top-left pixel origin of the output inside the source image.
let originX = crop.minX + CGFloat(tight.minX)
let topY = crop.maxY - CGFloat(tight.minY)
let outW = tight.rect.width, outH = tight.rect.height
func num(_ v: CGFloat) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.3f", Double(v))) }
func fx(_ x: CGFloat) -> NSDecimalNumber { num((x - originX) / outW) }
func fy(_ y: CGFloat) -> NSDecimalNumber { num((topY - y) / outH) }

// Downscale to at most 600px on the long side.
let scale = min(1, 600 / max(outW, outH))
let dw = Int((outW * scale).rounded()), dh = Int((outH * scale).rounded())
let dctx = CGContext(data: nil, width: dw, height: dh, bitsPerComponent: 8, bytesPerRow: 0,
                     space: CGColorSpaceCreateDeviceRGB(),
                     bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
dctx.interpolationQuality = .high
dctx.draw(trimmed, in: CGRect(x: 0, y: 0, width: dw, height: dh))
guard let finalCG = dctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fail("can't write \(outURL.path)")
}
CGImageDestinationAddImage(dest, finalCG, nil)
guard CGImageDestinationFinalize(dest) else { fail("can't write \(outURL.path)") }

// Width of the silhouette along a row of the output, as fractions. The
// mouth cavity has to stay inside it or its corners poke out.
func rowSpan(_ outFrac: CGFloat) -> [NSDecimalNumber] {
  let y = min(ch - 1, max(0, tight.minY + Int(outFrac * outH)))
  var lo = cw, hi = -1
  for x in 0..<cw where px[(y * cw + x) * 4 + 3] > 200 { lo = min(lo, x); hi = max(hi, x) }
  if hi < lo { return [num(0.3), num(0.7)] }
  return [num((CGFloat(lo - tight.minX)) / outW), num((CGFloat(hi - tight.minX)) / outW)]
}

var out: [String: Any] = ["src": "/media/" + outURL.lastPathComponent, "w": dw, "h": dh]
if mode == "head" {
  let mouth: CGFloat
  if let my = extras["mouthY"] as? CGFloat {
    mouth = (topY - my) / outH
    out["mouthX"] = [fx(extras["mouthX0"] as! CGFloat), fx(extras["mouthX1"] as! CGFloat)]
  } else {
    mouth = 0.72
    out["mouthX"] = [num(0.38), num(0.62)]
  }
  out["mouth"] = num(mouth)
  out["cut"] = rowSpan(mouth)
} else if let tip = extras["tip"] as? CGPoint, let base = extras["base"] as? CGPoint {
  out["tip"] = [fx(tip.x), fy(tip.y)]
  // Screen angle the finger points along: 0 is right, -90 is straight up.
  out["angle"] = Double(atan2(base.y - tip.y, tip.x - base.x) * 180 / .pi).rounded()
} else {
  out["tip"] = [0.5, 0]
  out["angle"] = -90
}
let json = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print("Paste into the \(mode == "head" ? "HEAD" : "HAND") config at the top of talk/talk.js:")
print(String(data: json, encoding: .utf8)!)
