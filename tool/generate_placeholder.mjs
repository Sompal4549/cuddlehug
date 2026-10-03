// Generates cuddlehug_app/assets/images/placeholder.png — the warm-cream
// fallback tile with a teddy silhouette (plan §10 error state).
// Run: node tool/generate_placeholder.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZE = 256;
const BG = [245, 239, 233, 255]; // AppColors.muted #F5EFE9
const FUR = [176, 133, 104, 255]; // soft cocoa
const MUZZLE = [234, 214, 196, 255];
const DARK = [90, 66, 52, 255];

function inside(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function pixel(x, y) {
  // 4x supersample for smooth edges.
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4;
      const py = y + (sy + 0.5) / 4;
      let c = BG;
      const earL = inside(px, py, 78, 82, 30);
      const earR = inside(px, py, 178, 82, 30);
      const head = inside(px, py, 128, 142, 64);
      const muzzle = inside(px, py, 128, 166, 30);
      const eyeL = inside(px, py, 106, 126, 8);
      const eyeR = inside(px, py, 150, 126, 8);
      const nose = inside(px, py, 128, 156, 11);
      if (earL || earR || head) c = FUR;
      if (muzzle) c = MUZZLE;
      if (nose) c = DARK;
      if (eyeL || eyeR) c = DARK;
      r += c[0]; g += c[1]; b += c[2]; a += c[3]; n++;
    }
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)];
}

// --- PNG encoding (RGBA8, one filter byte per scanline) ---
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = pixel(x, y);
    const o = row + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  }
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'cuddlehug_app', 'assets', 'images', 'placeholder.png');
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes', SIZE + 'x' + SIZE);
