// Generates favicons + PWA icons from the source app artwork using sharp.
// Run: node scripts/generate-icons.mjs
//
// The source (chat-chiu-logo.png) is presentation artwork: a rounded teal card
// (white border) with the chef-pig, sitting on a gray radial-gradient backdrop
// with a glow/shadow. The gray backdrop is NOT part of the icon, so we crop to
// the teal field (inside the white border) and use that as the single base art:
//   - Home-screen launcher icons (maskable + apple-touch): full-bleed square.
//     Launchers apply their own rounded mask, so the teal bleeds to every edge.
//   - Browser favicons, PWA "any" icons, and the in-app nav logo: same art with
//     our own rounded-corner alpha mask so corners are transparent.
//
// CROP is a centered square inside the white border (measured: card center is
// (512,500), teal half-extent ~327px). It keeps the full hat + ears + a teal
// margin, matching sibling apps, while excluding the border and gray backdrop.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'public', 'chat-chiu-logo.png');
const ICONS_DIR = path.join(root, 'public', 'icons');
const PUBLIC_DIR = path.join(root, 'public');
const IMAGES_DIR = path.join(root, 'public', 'images');

const CROP = { left: 185, top: 173, width: 654, height: 654 };
const CORNER_RATIO = 0.22; // rounded-corner radius as a fraction of icon size
// The source has a transparent backdrop; the crop's corners fall in it. Flatten
// onto the card's teal so interiors are fully opaque (launcher icons must be).
const TEAL = { r: 70, g: 154, b: 147 };

fs.mkdirSync(ICONS_DIR, { recursive: true });

// Base art: the teal field (transparent backdrop cropped away), square.
const fullBleed = await sharp(SRC).extract(CROP).png().toBuffer();

// Full-bleed square at `size` (opaque, teal to every edge) — launcher icons.
async function writeFullBleed(file, size) {
  const buf = await sharp(fullBleed)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: TEAL })
    .png()
    .toBuffer();
  fs.writeFileSync(file, buf);
  return buf;
}

// Rounded-corner square at `size` (transparent corners) — favicons / "any" / nav.
async function writeRounded(file, size) {
  const base = await sharp(fullBleed)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: TEAL })
    .png()
    .toBuffer();
  const radius = Math.round(size * CORNER_RATIO);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  const buf = await sharp(base)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  fs.writeFileSync(file, buf);
  return buf;
}

// 1. "any" PWA icons (rounded, transparent corners).
const anySizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of anySizes) {
  await writeRounded(path.join(ICONS_DIR, `icon-${s}x${s}.png`), s);
}

// 2. Maskable icons (full bleed — OS applies its own mask).
for (const s of [192, 512]) {
  await writeFullBleed(path.join(ICONS_DIR, `icon-maskable-${s}x${s}.png`), s);
}

// 3. Favicons (rounded, transparent corners).
for (const s of [16, 32, 48]) {
  await writeRounded(path.join(ICONS_DIR, `favicon-${s}x${s}.png`), s);
}

// 4. Apple touch icon (iOS rounds corners itself — full bleed, opaque).
await writeFullBleed(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 180);

// 5. In-app nav-bar / brand logo (rounded, transparent — toolbar + login).
fs.mkdirSync(IMAGES_DIR, { recursive: true });
await writeRounded(path.join(IMAGES_DIR, 'image.png'), 256);

// 6. favicon.ico — wrap a 48x48 rounded PNG in an ICO container (PNG-in-ICO).
const ico48 = await writeRounded(path.join(ICONS_DIR, 'favicon-48x48.png'), 48);
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

console.log('Generated: favicons (16/32/48 + .ico), apple-touch-icon, 8 "any" icons, 2 maskable icons, nav logo.');
