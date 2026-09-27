// Generates public/og-cover.png (1200x630) — abstract brand mark, no text.
// Dependency-free: raw RGBA render at 2x, box-downsample, encode PNG with zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1200;
const H = 630;
const SS = 2; // supersampling factor

// Brand palette
const PAPER = [0xf8, 0xf7, 0xf3];
const INK = [0x0b, 0x16, 0x28];
const ACCENT = [0x24, 0x6b, 0xfd];
const CARD = [0xff, 0xff, 0xff];
const LINE = [0x0b, 0x16, 0x28];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function roundRectSDF(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function circleSDF(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

function cover(sdf, aa) {
  return clamp01(0.5 - sdf / aa);
}

// Big canvas at 2x
const bw = W * SS;
const bh = H * SS;
const buf = new Float32Array(bw * bh * 4);

function blendAt(px, py, rgb, a) {
  if (a <= 0) return;
  const i = (py * bw + px) * 4;
  const k = 1 - a;
  buf[i] = buf[i] * k + rgb[0] * a;
  buf[i + 1] = buf[i + 1] * k + rgb[1] * a;
  buf[i + 2] = buf[i + 2] * k + rgb[2] * a;
}

// Fill paper
for (let y = 0; y < bh; y++) {
  for (let x = 0; x < bw; x++) {
    const i = (y * bw + x) * 4;
    buf[i] = PAPER[0];
    buf[i + 1] = PAPER[1];
    buf[i + 2] = PAPER[2];
    buf[i + 3] = 255;
  }
}

// Composition (coordinates in final space; multiply by SS when evaluating)
const shapes = [
  { kind: 'circle', cx: 1058, cy: 118, r: 190, rgb: ACCENT, a: 1 },
  { kind: 'circle', cx: 96, cy: 560, r: 120, rgb: INK, a: 1 },
  { kind: 'card', cx: 470, cy: 315, hw: 330, hh: 205, r: 28 },
];

for (let y = 0; y < bh; y++) {
  for (let x = 0; x < bw; x++) {
    const px = x / SS;
    const py = y / SS;
    const aa = 1.4;

    // Card shadow first (soft)
    {
      const d = roundRectSDF(px, py + 10, 470, 322, 330, 205, 28);
      const a = clamp01(-d / 90) * 0.16;
      if (a > 0) blendAt(x, y, INK, a);
    }
    // Card body
    {
      const d = roundRectSDF(px, py, 470, 315, 330, 205, 28);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, CARD, a);
    }
    // Skeleton lines inside card
    {
      const d = roundRectSDF(px, py, 385, 235, 165, 26, 13);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, ACCENT, a);
    }
    {
      const d = roundRectSDF(px, py, 430, 300, 240, 18, 9);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, LINE, a * 0.35);
    }
    {
      const d = roundRectSDF(px, py, 400, 345, 210, 18, 9);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, LINE, a * 0.22);
    }
    {
      const d = roundRectSDF(px, py, 415, 390, 185, 18, 9);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, LINE, a * 0.14);
    }
    // Big accent circle
    {
      const d = circleSDF(px, py, 1058, 118, 190);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, ACCENT, a);
    }
    // Small ink circle
    {
      const d = circleSDF(px, py, 96, 560, 120);
      const a = cover(d, aa);
      if (a > 0) blendAt(x, y, INK, a);
    }
    // Outlined accent ring
    {
      const d = circleSDF(px, py, 1120, 500, 70);
      const ring = Math.abs(d) - 10;
      const a = cover(ring, aa);
      if (a > 0) blendAt(x, y, ACCENT, a * 0.9);
    }
  }
}

// Box-downsample SSxSS -> final RGBA
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * bw + (x * SS + sx)) * 4;
        r += buf[i];
        g += buf[i + 1];
        b += buf[i + 2];
      }
    }
    const n = SS * SS;
    const o = (y * W + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = 255;
  }
}

// PNG encode
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter none
  out.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'og-cover.png');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`wrote ${target} (${png.length} bytes, ${W}x${H})`);
