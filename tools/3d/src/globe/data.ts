// Loads /3d/models/globe.bin (see scripts/pack-globe.mjs) into point attributes,
// and the places list the markers come from.
import { BufferAttribute, BufferGeometry } from 'three';

const LAT0 = -89.9;
const STEP = 0.1;
const D = Math.PI / 180;

/** Unit direction for a latitude and longitude, in the globe model's frame. */
export function direction(lat: number, lng: number): [number, number, number] {
  const a = lat * D, b = lng * D;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
}

async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buf);
  // A server may already have stripped the gzip layer.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Point geometry: position is the unit direction, _meta is the elevation in
 * 0..1 for land and -1 for rivers.
 */
export async function loadGlobePoints(url: string, signal?: AbortSignal): Promise<BufferGeometry> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('globe data ' + res.status);
  const data = await gunzip(await res.arrayBuffer());
  if (String.fromCharCode(data[0], data[1], data[2], data[3]) !== 'GLB1') throw new Error('globe data: bad header');
  const rows = data[4] | (data[5] << 8);
  let p = 6;
  const varint = () => {
    let n = 0, s = 0, b;
    do {
      b = data[p++];
      n |= (b & 127) << s;
      s += 7;
    } while (b & 128);
    return n;
  };
  // First pass: the run tables, so we know the point count.
  const runs: number[][] = [];
  let count = 0;
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (;;) {
      const gap = varint();
      const len = varint();
      if (len === 0) break;
      row.push(gap, len);
      count += len;
    }
    runs.push(row);
  }
  const pos = new Float32Array(count * 3);
  const meta = new Float32Array(count);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const lat = (LAT0 + r * STEP) * D;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    const step = Math.min(10, 0.1 / Math.cos(lat));
    const row = runs[r];
    let k = 0, prev = 0;
    for (let j = 0; j < row.length; j += 2) {
      k += row[j];
      for (let n = 0; n < row[j + 1]; n++, k++, i++) {
        const lng = (-180 + k * step) * D;
        pos[i * 3] = cl * Math.sin(lng);
        pos[i * 3 + 1] = sl;
        pos[i * 3 + 2] = cl * Math.cos(lng);
        const v = (prev + data[p++]) & 255;
        prev = v;
        meta[i] = v === 0 ? -1 : (v - 1) / 254;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('_meta', new BufferAttribute(meta, 1));
  return g;
}

export interface Place {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lng: number;
  date?: string;
  /** What the trip was for, one line. */
  for?: string;
  note?: string;
  /** Up to 3 photo paths for the hover card; defaults to the first 3 photos. */
  cover?: string[];
  videos?: string[];
  photos?: string[];
}

export async function loadPlaces(url: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(url, { signal, cache: 'no-cache' });
  if (!res.ok) throw new Error('places ' + res.status);
  const json = await res.json();
  const list: Place[] = Array.isArray(json) ? json : json.places || [];
  return list.filter((p) => p && p.id && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
