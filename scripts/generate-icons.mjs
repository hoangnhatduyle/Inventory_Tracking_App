// Generates favicons + PWA icons from the source logo using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'public', 'Chắt_Chiu_Logo.png');
const ICONS_DIR = path.join(root, 'public', 'icons');
const PUBLIC_DIR = path.join(root, 'public');

const MASKABLE_BG = { r: 255, g: 255, b: 255, alpha: 1 }; // solid bg for maskable/apple
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

fs.mkdirSync(ICONS_DIR, { recursive: true });

// Compute a tight bounding box of the actual logo. The source has opaque
// near-neutral (white/gray) specks scattered to the edges, so .trim() and an
// alpha scan both fail. The heart has a saturated red/pink outline and dark
// eyes, so detect logo pixels by color saturation OR darkness instead.
const ALPHA_MIN = 128;
const SAT_MIN = 25; // min (maxChannel - minChannel) to count as "colorful"
const DARK_MAX = 90; // max channel value to count as "dark" (the eyes)
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    const r = data[i], g = data[i + 1], b = data[i + 2], alpha = data[i + 3];
    if (alpha < ALPHA_MIN) continue;
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const isLogo = maxc - minc >= SAT_MIN || maxc <= DARK_MAX;
    if (isLogo) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const bbox = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
const trimmed = await sharp(SRC).extract(bbox).png().toBuffer();
console.log(`Logo bbox: ${bbox.width}x${bbox.height} at (${bbox.left},${bbox.top})`);

// Compose the trimmed logo, scaled to `coverage` of the canvas, centered on `bg`.
async function makeIcon(size, coverage, bg) {
  const content = Math.round(size * coverage);
  const logo = await sharp(trimmed)
    .resize(content, content, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function writeIcon(file, size, coverage, bg) {
  const buf = await makeIcon(size, coverage, bg);
  fs.writeFileSync(file, buf);
  return buf;
}

// 1. "any" PWA icons (transparent, edge-ish padding) — overwrite existing set.
const anySizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of anySizes) {
  await writeIcon(path.join(ICONS_DIR, `icon-${s}x${s}.png`), s, 0.84, TRANSPARENT);
}

// 2. Maskable icons (solid bg, logo inside ~66% safe zone).
for (const s of [192, 512]) {
  await writeIcon(path.join(ICONS_DIR, `icon-maskable-${s}x${s}.png`), s, 0.66, MASKABLE_BG);
}

// 3. Favicons (transparent, fills the tiny frame).
for (const s of [16, 32, 48]) {
  await writeIcon(path.join(ICONS_DIR, `favicon-${s}x${s}.png`), s, 0.94, TRANSPARENT);
}

// 4. Apple touch icon (iOS has no transparency/maskable — solid bg, padded).
await writeIcon(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 180, 0.8, MASKABLE_BG);

// 5. favicon.ico — wrap a 48x48 PNG in an ICO container (modern browsers read PNG-in-ICO).
const ico48 = await makeIcon(48, 0.94, TRANSPARENT);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry.writeUInt8(48, 0); // width
entry.writeUInt8(48, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(ico48.length, 8); // size of PNG data
entry.writeUInt32LE(6 + 16, 12); // offset to PNG data
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), Buffer.concat([header, entry, ico48]));

console.log('Generated: favicons (16/32/48 + .ico), apple-touch-icon, 8 "any" icons, 2 maskable icons.');
