#!/usr/bin/env node
/**
 * gen-icons.js
 * Generates real (non-empty) PNG launcher + PWA icons using pure Node
 * (no native deps, no network). Draws the app's pink→lavender gradient
 * rounded square with a centered white heart — an Iconsax-style
 * companion mark consistent with the pink/lavender/cream theme.
 *
 * Outputs:
 *   assets/icons/icon-192.png, icon-512.png   (PWA / manifest)
 *   android mipmap ic_launcher.png / ic_launcher_round.png (all densities)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');

// ── tiny helpers ──────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const PINK_TL = hex('#E8608A');
const PINK_MID = hex('#D4467A');
const LAV_BR = hex('#A970C8');

// Signed distance to a heart shape centered in unit square (0..1), returns true if inside.
function inHeart(nx, ny) {
  // map to heart param space centered, y up
  const x = (nx - 0.5) * 2.4;
  const y = (0.56 - ny) * 2.4;
  const a = x * x + y * y - 0.30;
  return (a * a * a - x * x * y * y * y) <= 0;
}

function makeIcon(size, rounded) {
  // RGBA buffer
  const buf = Buffer.alloc(size * size * 4);
  const r = size * (rounded ? 0.5 : 0.18); // corner radius (round -> circle)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / (size - 1);
      const ny = y / (size - 1);

      // rounded-rect / circle mask with anti-alias
      let inside = true;
      let alpha = 255;
      if (rounded) {
        const cx = size / 2, cy = size / 2;
        const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
        const edge = size / 2 - 0.5;
        if (d > edge) { inside = false; }
        else if (d > edge - 1.5) { alpha = Math.round(255 * (edge - d) / 1.5); }
      } else {
        // rounded rect corners
        const rx = Math.min(x, size - 1 - x);
        const ry = Math.min(y, size - 1 - y);
        if (rx < r && ry < r) {
          const d = Math.hypot(r - rx, r - ry);
          if (d > r) inside = false;
          else if (d > r - 1.5) alpha = Math.round(255 * (r - d) / 1.5);
        }
      }

      if (!inside) { buf[i + 3] = 0; continue; }

      // diagonal gradient
      const t = (nx + ny) / 2;
      let cr, cg, cb;
      if (t < 0.55) {
        const tt = t / 0.55;
        cr = lerp(PINK_TL[0], PINK_MID[0], tt);
        cg = lerp(PINK_TL[1], PINK_MID[1], tt);
        cb = lerp(PINK_TL[2], PINK_MID[2], tt);
      } else {
        const tt = (t - 0.55) / 0.45;
        cr = lerp(PINK_MID[0], LAV_BR[0], tt);
        cg = lerp(PINK_MID[1], LAV_BR[1], tt);
        cb = lerp(PINK_MID[2], LAV_BR[2], tt);
      }

      // white heart on top
      if (inHeart(nx, ny)) {
        cr = 255; cg = 255; cb = 255;
      }

      buf[i] = Math.round(cr);
      buf[i + 1] = Math.round(cg);
      buf[i + 2] = Math.round(cb);
      buf[i + 3] = alpha;
    }
  }
  return encodePNG(size, size, buf);
}

// ── minimal PNG encoder (RGBA, 8-bit) ─────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // filtered raw: prepend filter byte 0 per row
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`[gen-icons] ${path.relative(root, file)} (${buf.length} bytes)`);
}

// ── PWA icons ─────────────────────────────────────────────
write(path.join(root, 'assets/icons/icon-192.png'), makeIcon(192, false));
write(path.join(root, 'assets/icons/icon-512.png'), makeIcon(512, false));

// ── Android launcher icons (legacy PNG fallback) ──────────
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const resBase = path.join(root, 'android/app/src/main/res');
for (const [d, sz] of Object.entries(densities)) {
  write(path.join(resBase, `mipmap-${d}/ic_launcher.png`), makeIcon(sz, false));
  write(path.join(resBase, `mipmap-${d}/ic_launcher_round.png`), makeIcon(sz, true));
  // adaptive foreground raster fallback not required; anydpi-v26 handles 26+
}
console.log('[gen-icons] done');
