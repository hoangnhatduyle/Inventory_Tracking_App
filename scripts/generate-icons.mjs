// Generates favicons + PWA icons from the source app artwork using sharp.
// Run: node scripts/generate-icons.mjs
//
// The source (chac-chiu-icon.png, 1254x1254) is a finished app-icon design: a
// rounded card with a teal->orange vertical gradient holding the chef-pig,
// framed by a white border on a black backdrop. We keep the WHOLE bordered card
// (no zoom-in) so the pig has the same breathing room as the sibling cha-ching
// app — earlier versions cropped into the face and felt too tight.
//
//   - Browser favicons, PWA "any" icons, and the in-app nav logo: the full card
//     with our own rounded-corner alpha mask. The mask radius matches the white
//     border's outer corner (~175/1254 ≈ 0.14), so the transparent corners land
//     exactly on the border arc and replace the black backdrop triangles.
//   - Maskable launcher icons: the whole card scaled to 80% on a solid card-tone
//     background, so the OS mask (any shape) bites the padding, never the card.
//   - Apple-touch: the rounded card flattened onto white (iOS rounds again on
//     top); opaque, as iOS requires.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'public', 'chac-chiu-icon.png');
const ICONS_DIR = path.join(root, 'public', 'icons');
const PUBLIC_DIR = path.join(root, 'public');
const IMAGES_DIR = path.join(root, 'public', 'images');

// Rounded-corner radius as a fraction of icon size. Matches the source white
// border's outer corner radius (175px of 1254 ≈ 0.14) so masked corners align.
const CORNER_RATIO = 0.14;
// Maskable: fraction of the frame the card fills (rest is background padding so
// the OS mask never clips the card). Mirrors cha-ching's ~80%.
const MASKABLE_SCALE = 0.8;
// Padding/background tone for the maskable icon — the card's average color
// (measured ~173,143,104), matching cha-ching's technique of padding with the
// art's own dominant tone so the card appears to float on a coherent field.
const CARD_BG = { r: 173, g: 143, b: 104 };

fs.mkdirSync(ICONS_DIR, { recursive: true });

// Base art: the whole bordered card (full source), as a PNG buffer.
const baseArt = await sharp(SRC).png().toBuffer();

// Rounded-corner square at `size`. Transparent corners by default; pass
// `opaqueBg` to flatten them onto a solid color (for icons that must be opaque).
async function makeRounded(size, opaqueBg = null) {
  const base = await sharp(baseArt).resize(size, size, { fit: 'cover' }).png().toBuffer();
  const radius = Math.round(size * CORNER_RATIO);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`,
  );
  // Punch transparent corners first, then (if opaque requested) flatten the
  // result onto a solid color. These must be separate sharp passes: within one
  // pipeline sharp applies flatten before composite, which would no-op here.
  const masked = await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  if (!opaqueBg) return masked;
  return sharp(masked).flatten({ background: opaqueBg }).png().toBuffer();
}

// Rounded icon (transparent corners) — favicons / "any" / nav logo.
async function writeRounded(file, size) {
  const buf = await makeRounded(size);
  fs.writeFileSync(file, buf);
  return buf;
}

// Maskable icon — whole card scaled to MASKABLE_SCALE, centered on CARD_BG.
async function writeMaskable(file, size) {
  const inner = Math.round(size * MASKABLE_SCALE);
  const pad = Math.round((size - inner) / 2);
  const card = await sharp(baseArt).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
  const buf = await sharp({
    create: { width: size, height: size, channels: 3, background: CARD_BG },
  })
    .composite([{ input: card, top: pad, left: pad }])
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

// 2. Maskable icons (padded card — OS applies its own mask shape).
for (const s of [192, 512]) {
  await writeMaskable(path.join(ICONS_DIR, `icon-maskable-${s}x${s}.png`), s);
}

// 3. Favicons (rounded, transparent corners).
for (const s of [16, 32, 48]) {
  await writeRounded(path.join(ICONS_DIR, `favicon-${s}x${s}.png`), s);
}

// 4. Apple touch icon (opaque rounded card on white; iOS rounds further).
fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), await makeRounded(180, '#ffffff'));

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
