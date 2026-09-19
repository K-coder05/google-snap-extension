// Dev-only tool: renders icons/{16,32,48,128}.png from vector math (no
// external image deps, no raster source to keep in sync). Run with
// `node scripts/gen-icons.mjs`. Not part of the build or the shipped bundle.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ACCENT = [26, 115, 232]; // --accent from popup.css
const SIZES = [16, 32, 48, 128];

// Signed distance to an axis-aligned rounded box centered at (cx, cy) with
// half-extents (hw, hh) and corner radius r. Negative = inside.
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// ~1px soft edge for antialiasing, converts a signed distance to coverage.
function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d));
}

function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const bgR = size * 0.22;

  const pad = size * 0.2;
  const winHw = size / 2 - pad;
  const winHh = size / 2 - pad;
  const winR = Math.max(1, size * 0.07);
  const stroke = Math.max(1, size * 0.1);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      const dBg = sdRoundRect(px, py, cx, cy, size / 2, size / 2, bgR);
      const covBg = coverage(dBg);

      const dOuter = sdRoundRect(px, py, cx, cy, winHw, winHh, winR);
      const covOuter = coverage(dOuter);

      const innerHw = Math.max(0, winHw - stroke);
      const innerHh = Math.max(0, winHh - stroke);
      const innerR = Math.max(0, winR - stroke);
      const dInner = sdRoundRect(px, py, cx, cy, innerHw, innerHh, innerR);
      const covInner = coverage(dInner);

      const covBorder = covOuter * (1 - covInner);

      // Left half of the window interior reads as a solid fill; the right
      // half stays outline-only. Together they read as "half the frame is
      // captured, half isn't" — the extension's core split-window idea.
      const covLeftSide = coverage(px - cx);
      const covLeftFill = covInner * covLeftSide;

      let covWhite = Math.min(1, covBorder + covLeftFill);
      covWhite = Math.min(covWhite, covBg);

      const r = Math.round(ACCENT[0] * (1 - covWhite) + 255 * covWhite);
      const g = Math.round(ACCENT[1] * (1 - covWhite) + 255 * covWhite);
      const b = Math.round(ACCENT[2] * (1 - covWhite) + 255 * covWhite);
      const a = Math.round(covBg * 255);

      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline prefixed with filter-type byte 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const srcStart = y * size * 4;
    const dstStart = y * (size * 4 + 1);
    raw[dstStart] = 0;
    rgba.copy(raw, dstStart + 1, srcStart, srcStart + size * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, '..', 'icons');
mkdirSync(iconsDir, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, renderIcon(size));
  const outPath = path.join(iconsDir, `${size}.png`);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}
