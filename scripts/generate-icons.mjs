// Generates favicons + PWA icons from the source app artwork using sharp.
// Run: node scripts/generate-icons.mjs
//
// The source (chac-chiu-icon.png, 1254x1254) is a finished app-icon design: a
// rounded card with a teal->orange vertical gradient holding the chef-pig,
// framed by a 40px white border on a black backdrop. The white border and black
// backdrop are NOT part of the art, so we crop to the gradient card (inside the
// border) and use that as the single base art:
//   - Home-screen launcher icons (maskable + apple-touch): full-bleed square.
//     Launchers apply their own rounded mask, which clips the card's rounded
//     corners, so the gradient bleeds to every visible edge.
//   - Browser favicons, PWA "any" icons, and the in-app nav logo: same art with
//     our own rounded-corner alpha mask so corners are transparent.
//
// CROP is the gradient card's bounding box: a 40px white border surrounds the
// card on all sides (measured at the edge midpoints), so we inset 40px from
// every edge. The card center is (627,627); this keeps the full hat + ears.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'public', 'chac-chiu-icon.png');
const ICONS_DIR = path.join(root, 'public', 'icons');
const PUBLIC_DIR = path.join(root, 'public');
const IMAGES_DIR = path.join(root, 'public', 'images');

// CARD_CROP: the gradient card's full bounding box (40px white border inset on
// every edge). Used for rounded icons — our own alpha mask clips the corners,
// so the card's rounded corners + white arc never show, keeping max framing.
const CARD_CROP = { left: 40, top: 40, width: 1174, height: 1174 };
// BLEED_CROP: a tighter centered crop (~100px inset) whose corners land in pure
// gradient, past the white border's inward-curving arc. Used for full-bleed /
// maskable launcher icons, which have NO built-in rounding — the OS applies its
// own mask shape, so every corner must already be clean gradient (no white arc).
const BLEED_CROP = { left: 102, top: 102, width: 1050, height: 1050 };
const CORNER_RATIO = 0.22; // rounded-corner radius as a fraction of icon size

fs.mkdirSync(ICONS_DIR, { recursive: true });

// Base art: the gradient card. Two crops — see CARD_CROP / BLEED_CROP above.
const cardArt = await sharp(SRC).extract(CARD_CROP).png().toBuffer();
const bleedArt = await sharp(SRC).extract(BLEED_CROP).png().toBuffer();

// Full-bleed square at `size` (opaque, gradient to every edge) — launcher icons.
async function writeFullBleed(file, size) {
  const buf = await sharp(bleedArt)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();
  fs.writeFileSync(file, buf);
  return buf;
}

// Rounded-corner square at `size` (transparent corners) — favicons / "any" / nav.
async function writeRounded(file, size) {
  const base = await sharp(cardArt)
    .resize(size, size, { fit: 'cover' })
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
