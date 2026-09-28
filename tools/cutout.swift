// Cuts a head or a hand out of a photo with macOS Vision (macOS 14+) and
// prints the numbers talk.js needs.
//
//   swift tools/cutout.swift head photo.jpg media/head.png
//   swift tools/cutout.swift hand photo.jpg media/hands/point.png point
//   swift tools/cutout.swift thing photo.jpg media/cat/lie.webp [x,y]
//   swift tools/cutout.swift frames frames-dir/ media/cat/walk.webp
//
// Hand poses: point (anchor on the index tip), pinch (between thumb and index),
// fist (the knuckles), open (middle of the hand, for palms, peace signs, waves).
// Head: straight-on, mouth closed, face filling most of the frame. Also writes
// blink, angry, sad and happy versions next to it, morphed from the landmarks.
// Hands: plain background, whole hand in frame, wrist visible.
// Things (the cat): the biggest subject, or the one under x,y (0-1, from the top left).
// Frames: a folder of video frames, lifted and aligned into one sprite sheet.
// A .webp output path needs cwebp (brew install webp).

import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(1)
}
func warn(_ msg: String) { FileHandle.standardError.write(("warning: " + msg + "\n").data(using: .utf8)!) }

func write(_ img: CGImage, to url: URL) {
  let webp = url.pathExtension.lowercased() == "webp"
  let pngURL = webp ? URL(fileURLWithPath: NSTemporaryDirectory() + UUID().uuidString + ".png") : url
  guard let dest = CGImageDestinationCreateWithURL(pngURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fail("can't write \(url.path)")
  }
  CGImageDestinationAddImage(dest, img, nil)
  guard CGImageDestinationFinalize(dest) else { fail("can't write \(url.path)") }
  guard webp else { return }
  let p = Process()
  p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
  p.arguments = ["cwebp", "-quiet", "-q", "84", "-alpha_q", "95", pngURL.path, "-o", url.path]
  do { try p.run() } catch { fail("webp output needs cwebp: brew install webp") }
  p.waitUntilExit()
  try? FileManager.default.removeItem(at: pngURL)
  if p.terminationStatus != 0 { fail("cwebp failed on \(url.path)") }
}

// The biggest subject Vision found, for frames and things with no landmarks.
func largestLabel(_ obs: VNInstanceMaskObservation) -> Int? {
  let buf = obs.instanceMask
  CVPixelBufferLockBaseAddress(buf, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(buf, .readOnly) }
  let w = CVPixelBufferGetWidth(buf), h = CVPixelBufferGetHeight(buf), row = CVPixelBufferGetBytesPerRow(buf)
  let base = CVPixelBufferGetBaseAddress(buf)!.assumingMemoryBound(to: UInt8.self)
  var counts = [Int: Int]()
  for y in 0..<h { for x in 0..<w { let l = Int(base[y * row + x]); if l > 0 { counts[l, default: 0] += 1 } } }
  return counts.max { $0.value < $1.value }?.key
}


let args = CommandLine.arguments
let poses = ["point", "pinch", "fist", "open"]
guard (args.count == 4 && (args[1] == "head" || args[1] == "frames")) || ((args.count == 4 || args.count == 5) && (args[1] == "hand" || args[1] == "thing")),
      args.count < 5 || args[1] == "thing" || poses.contains(args[4]) else {
  fail("usage: swift tools/cutout.swift head <photo> <out>\n       swift tools/cutout.swift hand <photo> <out> [point|pinch|fist|open]\n       swift tools/cutout.swift thing <photo> <out> [x,y]\n       swift tools/cutout.swift frames <dir> <out>")
}
let mode = args[1]
let pose = args.count == 5 && mode == "hand" ? args[4] : "point"
let inURL = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

let ctx = CIContext()

if mode == "frames" {
  let files = try FileManager.default.contentsOfDirectory(at: inURL, includingPropertiesForKeys: nil)
    .filter { ["png", "jpg", "jpeg"].contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
  var frames: [(w: Int, h: Int, px: [UInt8])] = []
  for f in files {
    guard let ci = CIImage(contentsOf: f), let fcg = ctx.createCGImage(ci, from: ci.extent) else { fail("can't read \(f.path)") }
    let h = VNImageRequestHandler(cgImage: fcg)
    let req = VNGenerateForegroundInstanceMaskRequest()
    try h.perform([req])
    guard let obs = req.results?.first else { warn("nothing in \(f.lastPathComponent), skipping"); continue }
    let set = largestLabel(obs).map { IndexSet(integer: $0) } ?? obs.allInstances
    let m = try obs.generateScaledMaskForImage(forInstances: set, from: h)
    let lifted = CIImage(cgImage: fcg).applyingFilter("CIBlendWithMask", parameters: [
      kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: CIImage(cvPixelBuffer: m),
    ])
    let out = ctx.createCGImage(lifted, from: CGRect(x: 0, y: 0, width: fcg.width, height: fcg.height))!
    var px = [UInt8](repeating: 0, count: out.width * out.height * 4)
    let c = CGContext(data: &px, width: out.width, height: out.height, bitsPerComponent: 8, bytesPerRow: out.width * 4,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    c.draw(out, in: CGRect(x: 0, y: 0, width: out.width, height: out.height))
    frames.append((out.width, out.height, px))
  }
  guard let first = frames.first else { fail("no frames with a subject") }
  // One box that holds the subject in every frame, so nothing jitters.
  var x0 = first.w, y0 = first.h, x1 = -1, y1 = -1
  for f in frames {
    for y in 0..<f.h { for x in 0..<f.w where f.px[(y * f.w + x) * 4 + 3] > 24 {
      x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
    } }
  }
  let bw = x1 - x0 + 1, bh = y1 - y0 + 1
  let k = min(1, 240 / CGFloat(bh))
  let fw = Int((CGFloat(bw) * k).rounded()), fh = Int((CGFloat(bh) * k).rounded())
  let sheet = CGContext(data: nil, width: fw * frames.count, height: fh, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  sheet.interpolationQuality = .high
  for (i, var f) in frames.enumerated() {
    let fc = CGContext(data: &f.px, width: f.w, height: f.h, bitsPerComponent: 8, bytesPerRow: f.w * 4,
                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let crop = fc.makeImage()!.cropping(to: CGRect(x: x0, y: y0, width: bw, height: bh))!
    sheet.draw(crop, in: CGRect(x: i * fw, y: 0, width: fw, height: fh))
  }
  write(sheet.makeImage()!, to: outURL)
  let parts = outURL.path.components(separatedBy: "/media/")
  print("{\"frames\":\(frames.count),\"h\":\(fh),\"src\":\"/media/\(parts.count > 1 ? parts.last! : outURL.lastPathComponent)\",\"w\":\(fw)}")
  exit(0)
}

guard let src = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else {
  fail("can't read \(inURL.path)")
}
let image = src.transformed(by: CGAffineTransform(translationX: -src.extent.minX, y: -src.extent.minY))
guard let cg = ctx.createCGImage(image, from: image.extent) else { fail("can't decode image") }
let W = CGFloat(cg.width), H = CGFloat(cg.height)
let handler = VNImageRequestHandler(cgImage: cg)

// Vision and Core Image use a bottom-left origin. Everything below stays in
// that space (pixels) until the final fractions, which are top-left like the browser.
var crop = image.extent
var focus: CGPoint?  // a point on the subject we want, to pick it out of anything else in frame
var extras: [String: Any] = [:]
var faceObs: VNFaceObservation?
func mid(_ ps: [CGPoint]) -> CGPoint {
  CGPoint(x: ps.map(\.x).reduce(0, +) / CGFloat(ps.count), y: ps.map(\.y).reduce(0, +) / CGFloat(ps.count))
}

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
    focus = CGPoint(x: fb.midX, y: fb.midY)
    faceObs = face
    extras["mouthY"] = innerPts.map(\.y).reduce(0, +) / CGFloat(innerPts.count)
    extras["mouthX0"] = outerPts.map(\.x).min()!
    extras["mouthX1"] = outerPts.map(\.x).max()!
  } else {
    // Filters, sunglasses or odd angles can hide the face. Crop the photo to
    // the head yourself first, then set the mouth line by eye in talk.js.
    warn("no face found, guessing the mouth line")
  }
} else if mode == "thing" {
  if args.count == 5 {
    let xy = args[4].split(separator: ",").compactMap { Double($0) }
    guard xy.count == 2 else { fail("focus is x,y between 0 and 1, from the top left") }
    focus = CGPoint(x: CGFloat(xy[0]) * W, y: (1 - CGFloat(xy[1])) * H)
  }
} else {
  let handReq = VNDetectHumanHandPoseRequest()
  handReq.maximumHandCount = 1
  try handler.perform([handReq])
  if let hand = handReq.results?.first, let all = try? hand.recognizedPoints(.all) {
    func get(_ j: VNHumanHandPoseObservation.JointName) -> CGPoint? {
      guard let p = all[j], p.confidence > 0.2 else { return nil }
      return CGPoint(x: p.location.x * W, y: p.location.y * H)
    }
    let wrist = get(.wrist)
    let knuckles = [get(.indexMCP), get(.middleMCP), get(.ringMCP)].compactMap { $0 }
    let center = get(.middleMCP) ?? (knuckles.isEmpty ? nil : mid(knuckles))
    var at: CGPoint?
    var from: CGPoint?
    switch pose {
    case "point":
      at = get(.indexTip); from = get(.indexMCP) ?? wrist
    case "pinch":
      if let t = get(.thumbTip), let i = get(.indexTip) { at = mid([t, i]) }
      from = wrist
    case "fist":
      at = knuckles.isEmpty ? nil : mid(knuckles); from = wrist
    default:
      at = center; from = wrist
    }
    if let a = at, let f = from {
      extras["at"] = a
      extras["from"] = f
    } else {
      warn("couldn't find the \(pose) joints, guessing the anchor")
    }
    focus = center ?? wrist
    // Cut flat just below the wrist so it floats like the head does.
    if let w = wrist, let c = center {
      let cutY = max(0, w.y - hypot(c.x - w.x, c.y - w.y) * 0.3)
      crop = CGRect(x: 0, y: cutY, width: W, height: H - cutY)
    }
  } else {
    warn("no hand found, guessing the anchor is the top")
  }
}

// Subject lift: same model as "Copy Subject" in Photos. Keep only the subject
// under the face or hand, so a laptop edge in the frame doesn't come along.
let maskReq = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([maskReq])
guard let maskObs = maskReq.results?.first else { fail("no subject found") }
var instances = maskObs.allInstances
if mode == "thing" && focus == nil, let l = largestLabel(maskObs) { instances = IndexSet(integer: l) }
if let f = focus {
  let buf = maskObs.instanceMask
  CVPixelBufferLockBaseAddress(buf, .readOnly)
  let mw = CVPixelBufferGetWidth(buf), mh = CVPixelBufferGetHeight(buf)
  let row = CVPixelBufferGetBytesPerRow(buf)
  let base = CVPixelBufferGetBaseAddress(buf)!.assumingMemoryBound(to: UInt8.self)
  let mx = min(mw - 1, max(0, Int(f.x / W * CGFloat(mw))))
  let my = min(mh - 1, max(0, Int((1 - f.y / H) * CGFloat(mh))))
  let label = Int(base[my * row + mx])
  CVPixelBufferUnlockBaseAddress(buf, .readOnly)
  if label > 0 { instances = IndexSet(integer: label) }
}
let maskBuf = try maskObs.generateScaledMaskForImage(forInstances: instances, from: handler)
let cut = image.applyingFilter("CIBlendWithMask", parameters: [
  kCIInputBackgroundImageKey: CIImage.empty(),
  kCIInputMaskImageKey: CIImage(cvPixelBuffer: maskBuf),
])

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
let tight = CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
guard let trimmed = croppedCG.cropping(to: tight) else { fail("trim failed") }

// Top-left pixel origin of the output inside the source image.
let originX = crop.minX + tight.minX
let topY = crop.maxY - tight.minY
let outW = tight.width, outH = tight.height
func num(_ v: CGFloat) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.3f", Double(v))) }
func fx(_ x: CGFloat) -> NSDecimalNumber { num((x - originX) / outW) }
func fy(_ y: CGFloat) -> NSDecimalNumber { num((topY - y) / outH) }

// Width of the silhouette along a row of the output, as fractions. The
// mouth cavity has to stay inside it or its corners poke out.
func rowSpan(_ outFrac: CGFloat) -> [NSDecimalNumber] {
  let y = min(ch - 1, max(0, minY + Int(outFrac * outH)))
  var lo = cw, hi = -1
  for x in 0..<cw where px[(y * cw + x) * 4 + 3] > 200 { lo = min(lo, x); hi = max(hi, x) }
  if hi < lo { return [num(0.3), num(0.7)] }
  return [num(CGFloat(lo - minX) / outW), num(CGFloat(hi - minX) / outW)]
}

// Downscale: heads to 600px on the long side, hands to 400.
let scale = min(1, (mode == "head" ? 600 : 400) / max(outW, outH))
let dw = Int((outW * scale).rounded()), dh = Int((outH * scale).rounded())
let dctx = CGContext(data: nil, width: dw, height: dh, bitsPerComponent: 8, bytesPerRow: 0,
                     space: CGColorSpaceCreateDeviceRGB(),
                     bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
dctx.interpolationQuality = .high
dctx.draw(trimmed, in: CGRect(x: 0, y: 0, width: dw, height: dh))
guard let finalCG = dctx.makeImage() else { fail("resize failed") }

write(finalCG, to: outURL)

// ---- Expressions ----------------------------------------------------------
// A per-pixel warp of the finished head, driven by the face landmarks.
// Eyelids: each column between the eye corners slides the upper lid down by
// `close` of the eye's height, stretching the skin above over it. Brows and
// mouth corners: gaussian nudges.
struct Nudge { let at: CGPoint; let by: CGPoint; let r: CGFloat }
struct Eye { let x0: CGFloat; let x1: CGFloat; let upper: [CGPoint]; let lower: [CGPoint]; let h: CGFloat }

func lerpY(_ pts: [CGPoint], _ x: CGFloat) -> CGFloat {
  for i in 1..<pts.count where x <= pts[i].x {
    let a = pts[i - 1], b = pts[i]
    return b.x == a.x ? a.y : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)
  }
  return pts.last!.y
}

func morph(_ img: CGImage, eyes: [Eye], close: CGFloat, nudges: [Nudge]) -> CGImage {
  let w = img.width, h = img.height
  var src = [UInt8](repeating: 0, count: w * h * 4)
  let sctx = CGContext(data: &src, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  sctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  var dst = [UInt8](repeating: 0, count: w * h * 4)
  for y in 0..<h {
    for x in 0..<w {
      let fx = CGFloat(x) + 0.5, fy = CGFloat(y) + 0.5
      var sx = fx, sy = fy
      if close > 0 {
        for e in eyes where fx > e.x0 && fx < e.x1 {
          let top = lerpY(e.upper, fx), bot = lerpY(e.lower, fx), eh = bot - top
          if eh < 0.5 { continue }
          let k = e.h * 1.2
          let lid = top + close * eh
          if fy >= top - k && fy <= lid { sy = (top - k) + (fy - (top - k)) * k / (k + close * eh) }
          else if fy > lid && fy <= bot { sy = top + (fy - lid) * eh / (bot - lid) }
        }
      }
      for n in nudges {
        let d2 = (fx - n.at.x) * (fx - n.at.x) + (fy - n.at.y) * (fy - n.at.y)
        let g = exp(-d2 / (2 * n.r * n.r))
        sx -= n.by.x * g
        sy -= n.by.y * g
      }
      // Bilinear sample.
      let ax = min(max(sx - 0.5, 0), CGFloat(w - 1)), ay = min(max(sy - 0.5, 0), CGFloat(h - 1))
      let x0 = Int(ax), y0 = Int(ay), x1 = min(x0 + 1, w - 1), y1 = min(y0 + 1, h - 1)
      let tx = ax - CGFloat(x0), ty = ay - CGFloat(y0)
      for c in 0..<4 {
        let v00 = CGFloat(src[(y0 * w + x0) * 4 + c]), v10 = CGFloat(src[(y0 * w + x1) * 4 + c])
        let v01 = CGFloat(src[(y1 * w + x0) * 4 + c]), v11 = CGFloat(src[(y1 * w + x1) * 4 + c])
        let v = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty
        dst[(y * w + x) * 4 + c] = UInt8(min(255, max(0, v.rounded())))
      }
    }
  }
  let dctx = CGContext(data: &dst, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  return dctx.makeImage()!
}

var faces: [String: String] = [:]
if mode == "head", let lm = faceObs?.landmarks,
   let le = lm.leftEye, let re = lm.rightEye, let lb = lm.leftEyebrow, let rb = lm.rightEyebrow, let lips = lm.outerLips {
  let size = CGSize(width: W, height: H)
  let out = { (p: CGPoint) in CGPoint(x: (p.x - originX) * scale, y: (topY - p.y) * scale) }
  func eye(_ r: VNFaceLandmarkRegion2D) -> Eye {
    let pts = r.pointsInImage(imageSize: size).map(out)
    let a = pts.min { $0.x < $1.x }!, b = pts.max { $0.x < $1.x }!
    let chord = { (x: CGFloat) in a.y + (b.y - a.y) * (x - a.x) / max(1, b.x - a.x) }
    let upper = ([a, b] + pts.filter { $0.y < chord($0.x) }).sorted { $0.x < $1.x }
    let lower = ([a, b] + pts.filter { $0.y > chord($0.x) }).sorted { $0.x < $1.x }
    return Eye(x0: a.x, x1: b.x, upper: upper, lower: lower, h: pts.map(\.y).max()! - pts.map(\.y).min()!)
  }
  let eyes = [eye(le), eye(re)]
  if ProcessInfo.processInfo.environment["CUTOUT_DEBUG"] != nil {
    let dump = { (r: VNFaceLandmarkRegion2D) in r.pointsInImage(imageSize: size).map(out).map { [Int($0.x), Int($0.y)] } }
    FileHandle.standardError.write("\(["le": dump(le), "re": dump(re), "lb": dump(lb), "rb": dump(rb), "lips": dump(lips)])\n".data(using: .utf8)!)
  }
  let centers = [le, re].map { mid($0.pointsInImage(imageSize: size).map(out)) }
  let u = hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y)
  let midX = (centers[0].x + centers[1].x) / 2
  // Brow control points, inner end first.
  let brows = [lb, rb].map { r -> [CGPoint] in
    let pts = r.pointsInImage(imageSize: size).map(out)
    let inner = pts.min { abs($0.x - midX) < abs($1.x - midX) }!
    let outer = pts.max { abs($0.x - midX) < abs($1.x - midX) }!
    return [inner, CGPoint(x: (inner.x + outer.x) / 2, y: lerpY(pts.sorted { $0.x < $1.x }, (inner.x + outer.x) / 2)), outer]
  }
  let lipPts = lips.pointsInImage(imageSize: size).map(out)
  let corners = [lipPts.min { $0.x < $1.x }!, lipPts.max { $0.x < $1.x }!]
  let inward = { (p: CGPoint) in p.x < midX ? CGFloat(1) : CGFloat(-1) }
  // Cartoon amounts, in units of the distance between the eyes: the head
  // shows up around 100px wide, so subtle doesn't read.
  func browNudge(inner: CGFloat, mid: CGFloat, outer: CGFloat, pull: CGFloat) -> [Nudge] {
    brows.flatMap { b in [
      Nudge(at: b[0], by: CGPoint(x: inward(b[0]) * pull * u, y: inner * u), r: 0.24 * u),
      Nudge(at: b[1], by: CGPoint(x: 0, y: mid * u), r: 0.24 * u),
      Nudge(at: b[2], by: CGPoint(x: 0, y: outer * u), r: 0.24 * u),
    ] }
  }
  func mouth(down: CGFloat, in inAmt: CGFloat) -> [Nudge] {
    corners.map { Nudge(at: $0, by: CGPoint(x: inward($0) * inAmt * u, y: down * u), r: 0.26 * u) }
  }
  let variants: [(name: String, close: CGFloat, nudges: [Nudge])] = [
    ("blink", 1, []),
    ("angry", 0.45, browNudge(inner: 0.17, mid: 0.08, outer: -0.03, pull: 0.07) + mouth(down: 0.1, in: 0.035)),
    ("sad", 0.2, browNudge(inner: -0.14, mid: -0.04, outer: 0.05, pull: 0.03) + mouth(down: 0.14, in: 0.02)),
    ("happy", 0.35, mouth(down: -0.13, in: -0.035)),
  ]
  for v in variants {
    let name = outURL.deletingPathExtension().lastPathComponent + "-" + v.name + "." + outURL.pathExtension
    write(morph(finalCG, eyes: eyes, close: v.close, nudges: v.nudges), to: outURL.deletingLastPathComponent().appendingPathComponent(name))
    faces[v.name] = name
  }
} else if mode == "head" {
  warn("no landmarks, skipping the expressions")
}

let parts = outURL.path.components(separatedBy: "/media/")
var out: [String: Any] = ["src": "/media/" + (parts.count > 1 ? parts.last! : outURL.lastPathComponent), "w": dw, "h": dh]
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
  let dir = (out["src"] as! String).components(separatedBy: "/").dropLast().joined(separator: "/")
  if !faces.isEmpty { out["faces"] = faces.mapValues { dir + "/" + $0 } }
} else if mode == "thing" {
  // Nothing to anchor; w and h are all talk.js needs.
} else if let at = extras["at"] as? CGPoint, let from = extras["from"] as? CGPoint {
  out["at"] = [fx(at.x), fy(at.y)]
  // Screen angle the gesture faces: 0 is right, -90 is straight up.
  out["angle"] = Int((atan2(from.y - at.y, at.x - from.x) * 180 / .pi).rounded())
} else {
  out["at"] = [num(0.5), num(0.05)]
  out["angle"] = -90
}
let json = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: json, encoding: .utf8)!)
