import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const COL = {
  bg: [20, 83, 45, 255], // #14532d
  panel: [22, 163, 74, 255], // #16a34a
  bar: [255, 255, 255, 255],
  tick: [255, 255, 255, 255],
};

function insideRoundedRect(x, y, cx, cy, w, h, r) {
  const rx = Math.abs(x - cx), ry = Math.abs(y - cy);
  const hw = w / 2, hh = h / 2;
  if (rx > hw || ry > hh) return false;
  if (rx <= hw - r || ry <= hh - r) return true;
  const dx = rx - (hw - r), dy = ry - (hh - r);
  return dx * dx + dy * dy <= r * r;
}

function buildIcon(size, maskable) {
  const ss = 2;
  const w = size, h = size;
  const rgba = Buffer.alloc(w * h * 4);
  const safe = maskable ? 0.84 : 1.0; // keep content safe zone
  const cen = size / 2;
  const panelW = size * 0.66 * safe;
  const panelH = size * 0.66 * safe;
  const r = panelW * 0.16;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bg = 0, panel = 0, bars = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          if (!maskable && insideRoundedRect(px, py, cen, cen, panelW, panelH, r)) {
            panel++;
            const relX = px - (cen - panelW / 2);
            const relY = py - (cen - panelH / 2);
            // three whitespace-separated lines + a thicker total line
            const lineH = panelH * 0.075;
            const gap = panelH * 0.1;
            const startY = cen - panelH / 2 + panelH * 0.28;
            const widths = [0.72, 0.52, 0.62];
            for (let i = 0; i < 3; i++) {
              const ly = startY + i * (lineH + gap);
              if (py >= ly - lineH / 2 && py <= ly + lineH / 2 && relX >= panelW * (0.18) && relX <= panelW * (0.18 + widths[i] * 0.64)) {
                bars++;
                break;
              }
            }
            // tick
            const ty = startY + 3 * (lineH + gap) - gap + gap * 0.3;
            const tx0 = panelW * 0.18, ty0 = ty;
            const x1p = panelW * 0.18 + panelW * 0.2, y1p = ty + lineH * 0.7;
            const check = (bx, by, xa, ya, xb, yb) => {
              const vx = xb - xa, vy = yb - ya;
              const wx = bx - xa, wy = by - ya;
              const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
              const dx = bx - (xa + t * vx), dy = by - (ya + t * vy);
              return Math.sqrt(dx * dx + dy * dy) <= lineH * 0.32;
            };
            if (check(px, py, tx0, ty0, x1p, y1p) || check(px, py, x1p, y1p, panelW * 0.62, ty0)) bars++;
            if (bars === 0) bars += 0;
          } else {
            bg++;
          }
        }
      }
      const total = ss * ss;
      let R = COL.bg[0], G = COL.bg[1], B = COL.bg[2], A = 255;
      if (panel > 0) {
        R = Math.round((COL.panel[0] * panel + COL.bg[0] * bg) / total);
        G = Math.round((COL.panel[1] * panel + COL.bg[1] * bg) / total);
        B = Math.round((COL.panel[2] * panel + COL.bg[2] * bg) / total);
      }
      if (bars > 0) {
        const bf = bars / total;
        R = Math.round(COL.bg[0] * (1 - bf) + 255 * bf);
        G = Math.round(COL.bg[1] * (1 - bf) + 255 * bf);
        B = Math.round(COL.bg[2] * (1 - bf) + 255 * bf);
      }
      const off = (y * w + x) * 4;
      rgba[off] = R; rgba[off + 1] = G; rgba[off + 2] = B; rgba[off + 3] = A;
    }
  }
  return encodePng(w, h, rgba);
}

const sizes = [144, 180, 192, 512];
for (const s of sizes) {
  let name;
  if (s === 180) name = "apple-touch-icon.png";
  else name = `icon-${s}x${s}.png`;
  writeFileSync(join(outDir, name), buildIcon(s, false));
  console.log("wrote", name);
}
writeFileSync(join(outDir, "maskable-icon-512x512.png"), buildIcon(512, true));
console.log("wrote maskable-icon-512x512.png");