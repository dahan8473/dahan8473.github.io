// Packs the tsi-globe point cloud (public/globe.glb, 10 MB) into public/models/globe.bin.
//
// The source glb stores 1.2M points as float32 unit directions plus float32
// elevation and land. Every point sits on a latitude row 0.1 degrees apart, with
// about 3600 * cos(lat) points per row, so the directions can be rebuilt from
// grid indices. The packed file is gzip of:
//
//   "GLB1" | u16 rows | per row: varint pairs (gap, run) ending with a 0 run
//   then one byte per point: 0 = river, 1..255 = land with elevation (v - 1) / 254,
//   delta coded along the row so gzip has an easier time.
//
// Row r has latitude LAT0 + r * 0.1 and slot k sits at longitude
// -180 + k * step, step = min(10, 0.1 / cos(lat)), the same grid the source was
// sampled on, so nothing moves. The decoder in src/globe/data.ts mirrors this.
//
// Usage: node scripts/pack-globe.mjs ~/Developer/tsi-globe/public/globe.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/pack-globe.mjs <globe.glb>'); process.exit(1); }
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/models/globe.bin');

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const dir = prim.getAttribute('_DIRECTION').getArray();
const elev = prim.getAttribute('_ELEVATION').getArray();
const land = prim.getAttribute('_LAND').getArray();
const count = land.length;

const LAT0 = -89.9, STEP = 0.1, ROWS = 1799;
const D = 180 / Math.PI;
const rows = Array.from({ length: ROWS }, () => new Map());
let worst = 0, dupes = 0;
for (let i = 0; i < count; i++) {
  const x = dir[i * 3], y = dir[i * 3 + 1], z = dir[i * 3 + 2];
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * D;
  // glb convention: (cos(lat) sin(lon), sin(lat), cos(lat) cos(lon))
  const lon = Math.atan2(x, z) * D;
  const r = Math.round((lat - LAT0) / STEP);
  if (r < 0 || r >= ROWS) continue;
  const rl = LAT0 + r * STEP;
  const step = Math.min(10, 0.1 / Math.cos(rl / D));
  const k = Math.round((((lon + 180) % 360) + 360) % 360 / step);
  const back = -180 + k * step;
  let dl = Math.abs(back - lon); if (dl > 180) dl = 360 - dl;
  worst = Math.max(worst, dl * Math.cos(rl / D), Math.abs(rl - lat));
  const v = land[i] > 0.5 ? 1 + Math.round(Math.max(0, Math.min(1, elev[i])) * 254) : 0;
  const m = rows[r];
  if (m.has(k)) { dupes++; m.set(k, Math.max(m.get(k), v)); } else m.set(k, v);
}

const head = [];
const body = [];
const varint = (a, n) => { while (n >= 128) { a.push((n & 127) | 128); n >>>= 7; } a.push(n); };
let kept = 0;
for (let r = 0; r < ROWS; r++) {
  const ks = [...rows[r].keys()].sort((a, b) => a - b);
  let pos = 0, i = 0, prev = 0;
  while (i < ks.length) {
    let j = i;
    while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++;
    varint(head, ks[i] - pos);
    varint(head, j - i + 1);
    pos = ks[j] + 1;
    i = j + 1;
  }
  varint(head, 0); varint(head, 0);
  for (const k of ks) { const v = rows[r].get(k); body.push((v - prev + 256) & 255); prev = v; kept++; }
}
const magic = Buffer.from('GLB1');
const hdr = Buffer.alloc(2); hdr.writeUInt16LE(ROWS);
const raw = Buffer.concat([magic, hdr, Buffer.from(head), Buffer.from(body)]);
const gz = gzipSync(raw, { level: 9 });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, gz);
console.log(`points ${count} kept ${kept} merged ${dupes} worst offset ${worst.toFixed(4)} deg`);
console.log(`runs ${head.length} B, values ${body.length} B, raw ${raw.length} B, gzip ${gz.length} B -> ${out}`);
