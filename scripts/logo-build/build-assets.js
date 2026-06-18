/**
 * Flokk logo asset builder — pass 2
 *
 * Converts DM Sans 700 glyphs to path outlines once, then rasterizes:
 *   public/favicon.ico          (16/32/48 multi-size ICO)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/apple-touch-icon.png (180×180)
 *   public/icon-192.png         (PWA 192)
 *   public/icon-512.png         (PWA 512)
 *   public/icon-512-maskable.png(PWA 512 maskable, safe-zone padded)
 *   public/og-image.png         (1200×630 OG/Twitter share card)
 *
 * Run: node scripts/logo-build/build-assets.js
 */

const fs   = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const sharp    = require('sharp');

const FONT_PATH   = path.join(__dirname, 'dm-sans-700.ttf');
const PUBLIC_DIR  = path.join(__dirname, '../../public');

const NAVY  = '#1B3A5C';
const TERRA = '#C4664A';
const PAPER = '#FAF7F2';
const WHITE = '#ffffff';

// ── 1. Extract glyph path data ──────────────────────────────────────────────
const font = opentype.parse(fs.readFileSync(FONT_PATH).buffer);

// DM Sans 700 uses CCMP lookupType 6 substFormat 2 which opentype.js doesn't support
// via font.getPath(). Access glyphs character-by-character to bypass GSUB/Bidi entirely.
//
// opentype.js roundDecimal() has a bug: any value whose fractional part is a
// sub-epsilon float (e.g. 119.00000000000001 → frac 1.42e-14) causes the
// "n + 'e+4'" string trick to produce NaN.  Pre-rounding to 4 decimal places
// before combining paths avoids the bug for ALL values.
function sanitize(v) { return Math.round(v * 10000) / 10000; }
function sanitizeCmd(cmd) {
  const out = { type: cmd.type };
  for (const k of ['x','y','x1','y1','x2','y2']) {
    if (k in cmd) out[k] = sanitize(cmd[k]);
  }
  return out;
}

function getPath(text, x, y, size) {
  const scale = size / font.unitsPerEm;
  const combined = new opentype.Path();
  let xPos = x;
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const p = glyph.getPath(xPos, y, size);
    combined.commands.push(...p.commands.map(sanitizeCmd));
    xPos += (glyph.advanceWidth || 0) * scale;
  }
  return combined;
}

function getAdvanceWidth(text, size) {
  const scale = size / font.unitsPerEm;
  let total = 0;
  for (const char of text) {
    total += (font.charToGlyph(char).advanceWidth || 0) * scale;
  }
  return total;
}

/**
 * Returns a <path d="…"/> SVG string for `text` at the given fontSize,
 * shifted so the bounding box starts at (0, 0).
 * Returns { pathEl, width, height } in px (=units at fontSize).
 */
function glyphsToSVGPath(text, fontSize, fillColor = WHITE) {
  const path = getPath(text, 0, 0, fontSize);
  const bb   = path.getBoundingBox();
  // Shift so top-left of the tight bounding box is (0,0)
  const shifted = getPath(text, -bb.x1, -bb.y1, fontSize);
  const d = shifted.toPathData(4);
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  return { d, width: w, height: h };
}

/**
 * "f." — two-color path: "f" in white, "." in terracotta.
 * Returns an SVG string with both paths.
 */
function fDotPaths(fontSize) {
  const fPath  = getPath('f', 0, 0, fontSize);
  const fBB    = fPath.getBoundingBox();
  const fH     = fBB.y2 - fBB.y1;
  const fW     = fBB.x2 - fBB.x1;

  // Position dot right after 'f' with a small gap
  const advance = getAdvanceWidth('f', fontSize);
  const dotPath = getPath('.', 0, 0, fontSize);
  const dotBB   = dotPath.getBoundingBox();

  // Align baselines: use the same y-baseline offset
  // Find the baseline: the origin y=0 is the baseline in opentype coords
  // fBB.y1 is the top offset (negative for ascender)
  // We shift both so that the combined BB starts at (0,0)
  const combinedY1 = Math.min(fBB.y1, dotBB.y1);
  const combinedX1 = fBB.x1;

  const fShifted   = getPath('f', -combinedX1, -combinedY1, fontSize);
  const dotShifted = getPath('.', advance - combinedX1, -combinedY1, fontSize);

  const dotBBShifted = dotShifted.getBoundingBox();
  const fBBShifted   = fShifted.getBoundingBox();

  const totalW = Math.max(fBBShifted.x2, dotBBShifted.x2);
  const totalH = Math.max(fBBShifted.y2, dotBBShifted.y2);

  return {
    fD:     fShifted.toPathData(4),
    dotD:   dotShifted.toPathData(4),
    width:  totalW,
    height: totalH,
  };
}

/**
 * "flokk." — split at period: "flokk" in white/navy, "." in terracotta.
 */
function flokkDotPaths(fontSize, wordColor = WHITE) {
  // "flokk" advance
  const advance = getAdvanceWidth('flokk', fontSize);

  const wordPath = getPath('flokk', 0, 0, fontSize);
  const dotPath  = getPath('.', 0, 0, fontSize);
  const wordBB   = wordPath.getBoundingBox();
  const dotBB    = dotPath.getBoundingBox();

  const combinedY1 = Math.min(wordBB.y1, dotBB.y1);
  const combinedX1 = wordBB.x1;

  const wordShifted = getPath('flokk', -combinedX1, -combinedY1, fontSize);
  const dotShifted  = getPath('.', advance - combinedX1, -combinedY1, fontSize);

  const dotBBShifted  = dotShifted.getBoundingBox();
  const wordBBShifted = wordShifted.getBoundingBox();

  const totalW = Math.max(wordBBShifted.x2, dotBBShifted.x2);
  const totalH = Math.max(wordBBShifted.y2, dotBBShifted.y2);

  return {
    wordD:  wordShifted.toPathData(4),
    dotD:   dotShifted.toPathData(4),
    width:  totalW,
    height: totalH,
    wordColor,
  };
}

// ── 2. SVG builders ──────────────────────────────────────────────────────────

/**
 * Square favicon: navy background, "f." centered.
 * size = canvas size in px; fontSize chosen to fill ~60% of canvas.
 */
function buildFaviconSVG(canvasSize) {
  const fontSize = Math.round(canvasSize * 0.68);
  const { fD, dotD, width, height } = fDotPaths(fontSize);

  // Center the glyph group in the square canvas
  const tx = (canvasSize - width) / 2;
  const ty = (canvasSize - height) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <rect width="${canvasSize}" height="${canvasSize}" fill="${NAVY}" rx="${Math.round(canvasSize * 0.18)}"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)})">
    <path d="${fD}" fill="${WHITE}"/>
    <path d="${dotD}" fill="${TERRA}"/>
  </g>
</svg>`;
}

/**
 * Square icon: navy background, "flokk." centered.
 * For sizes where the full wordmark fits well (192, 512, 180).
 */
function buildWordmarkIconSVG(canvasSize, { maskable = false } = {}) {
  // Maskable icons need 10% safe zone on all sides (20% total)
  const safeZone = maskable ? 0.20 : 0.0;
  const usableSize = canvasSize * (1 - safeZone);
  const padding = canvasSize * (safeZone / 2);

  // Try "flokk." at a fontSize that fits within usable width
  let fontSize = Math.round(usableSize * 0.32);
  let { wordD, dotD, width, height, wordColor } = flokkDotPaths(fontSize, WHITE);

  // Scale down if glyph width exceeds usable area
  if (width > usableSize * 0.85) {
    const scale = (usableSize * 0.85) / width;
    fontSize = Math.round(fontSize * scale);
    ({ wordD, dotD, width, height, wordColor } = flokkDotPaths(fontSize, WHITE));
  }

  const tx = padding + (usableSize - width) / 2;
  const ty = padding + (usableSize - height) / 2;

  const rx = maskable ? 0 : Math.round(canvasSize * 0.18);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <rect width="${canvasSize}" height="${canvasSize}" fill="${NAVY}" rx="${rx}"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)})">
    <path d="${wordD}" fill="${WHITE}"/>
    <path d="${dotD}" fill="${TERRA}"/>
  </g>
</svg>`;
}

/**
 * Email header logo: 240×68 transparent PNG (2× retina, display at 120×34).
 * Navy background so it blends with the email header row (#1B3A5C).
 * "flokk" in white, "." in terracotta.
 */
function buildEmailLogoSVG() {
  const W = 240, H = 68;
  // Target the wordmark at ~210px wide within the 240px canvas
  let fontSize = 52;
  let { wordD, dotD, width, height } = flokkDotPaths(fontSize, WHITE);
  if (width > W * 0.88) {
    const scale = (W * 0.88) / width;
    fontSize = Math.round(fontSize * scale);
    ({ wordD, dotD, width, height } = flokkDotPaths(fontSize, WHITE));
  }
  const tx = (W - width) / 2;
  const ty = (H - height) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)})">
    <path d="${wordD}" fill="${WHITE}"/>
    <path d="${dotD}" fill="${TERRA}"/>
  </g>
</svg>`;
}

/**
 * OG image: 1200×630, paper background, large "flokk." in navy.
 */
function buildOGImageSVG() {
  const W = 1200, H = 630;
  const fontSize = 140;
  const { wordD, dotD, width, height } = flokkDotPaths(fontSize, NAVY);

  const tx = (W - width) / 2;
  const ty = (H - height) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <!-- subtle border -->
  <rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="rgba(27,58,92,0.08)" stroke-width="2"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)})">
    <path d="${wordD}" fill="${NAVY}"/>
    <path d="${dotD}" fill="${TERRA}"/>
  </g>
  <!-- tagline -->
  ${buildTaglinePaths(W, ty + height + 36, fontSize)}
</svg>`;
}

function buildTaglinePaths(W, y, _ref) {
  // Use the font to render the tagline as path
  const size = 28;
  const text = 'Save it, plan it, book it, share it.';
  const { wordD, dotD, width, height } = flokkDotPaths(size, NAVY);
  // Build full tagline path
  const tp = getPath(text, 0, 0, size);
  const bb = tp.getBoundingBox();
  const tpShifted = getPath(text, -bb.x1, -bb.y1, size);
  const tw = bb.x2 - bb.x1;
  const tx = (W - tw) / 2;
  const th = bb.y2 - bb.y1;
  const ty = y;
  return `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)})">
    <path d="${tpShifted.toPathData(4)}" fill="rgba(27,58,92,0.55)"/>
  </g>`;
}

// ── 3. Rasterize SVG → PNG using Sharp ──────────────────────────────────────

async function svgToPng(svgString, outPath) {
  await sharp(Buffer.from(svgString))
    .png()
    .toFile(outPath);
  const { width, height } = await sharp(outPath).metadata();
  console.log(`  ✓ ${path.basename(outPath)} (${width}×${height})`);
}

// ── 4. ICO encoder (pure JS, PNG payloads at 16/32/48) ───────────────────────

async function buildICO(pngPaths, outPath) {
  const images = await Promise.all(pngPaths.map(async (p) => {
    // Re-encode each as a raw PNG buffer (Sharp can resize to exact size)
    const size = parseInt(path.basename(p).replace(/[^0-9]/g, ''), 10);
    const buf = await sharp(p).resize(size, size).png().toBuffer();
    return { size, buf };
  }));

  // ICO binary format:
  // Header (6 bytes) + directory entries (16 bytes each) + image data
  const count = images.length;
  const headerSize = 6 + 16 * count;
  const dataOffset = headerSize;

  let currentOffset = dataOffset;
  const entries = images.map(({ size, buf }) => {
    const entry = { size, buf, offset: currentOffset };
    currentOffset += buf.length;
    return entry;
  });

  const totalSize = currentOffset;
  const ico = Buffer.alloc(totalSize);

  // ICO header
  ico.writeUInt16LE(0, 0);     // reserved
  ico.writeUInt16LE(1, 2);     // type: 1=ICO
  ico.writeUInt16LE(count, 4); // number of images

  // Directory entries
  entries.forEach(({ size, buf, offset }, i) => {
    const base = 6 + i * 16;
    ico.writeUInt8(size >= 256 ? 0 : size, base);      // width (0=256)
    ico.writeUInt8(size >= 256 ? 0 : size, base + 1);  // height
    ico.writeUInt8(0, base + 2);  // color count
    ico.writeUInt8(0, base + 3);  // reserved
    ico.writeUInt16LE(1, base + 4); // color planes
    ico.writeUInt16LE(32, base + 6); // bits per pixel
    ico.writeUInt32LE(buf.length, base + 8); // image size
    ico.writeUInt32LE(offset, base + 12);    // image offset
  });

  // Image data
  entries.forEach(({ buf, offset }) => {
    buf.copy(ico, offset);
  });

  fs.writeFileSync(outPath, ico);
  console.log(`  ✓ ${path.basename(outPath)} (${images.map(e => e.size).join('/')}px multi)`);
}

// ── 5. Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Building Flokk logo assets…\n');

  // Favicon PNGs (16, 32, 48)
  const fav16svg = buildFaviconSVG(16);
  const fav32svg = buildFaviconSVG(32);
  const fav48svg = buildFaviconSVG(48);

  const tmp16 = path.join(__dirname, '_fav16.png');
  const tmp32 = path.join(__dirname, '_fav32.png');
  const tmp48 = path.join(__dirname, '_fav48.png');

  await svgToPng(fav16svg, tmp16);
  await svgToPng(fav32svg, tmp32);
  await svgToPng(fav48svg, tmp48);

  // Copy 16 and 32 to public/ for <link> fallbacks
  await sharp(tmp16).png().toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));
  await sharp(tmp32).png().toFile(path.join(PUBLIC_DIR, 'favicon-32x32.png'));
  console.log(`  ✓ favicon-16x16.png + favicon-32x32.png`);

  // Build multi-size ICO
  await buildICO([tmp16, tmp32, tmp48], path.join(PUBLIC_DIR, 'favicon.ico'));

  // Overwrite old favicon.png (used as apple shortcut)
  await sharp(tmp32).png().toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  console.log(`  ✓ favicon.png (32px)`);

  // apple-touch-icon (180×180) — full wordmark
  await svgToPng(
    buildWordmarkIconSVG(180),
    path.join(PUBLIC_DIR, 'apple-touch-icon.png'),
  );

  // PWA icons
  await svgToPng(
    buildWordmarkIconSVG(192),
    path.join(PUBLIC_DIR, 'icon-192.png'),
  );
  await svgToPng(
    buildWordmarkIconSVG(512),
    path.join(PUBLIC_DIR, 'icon-512.png'),
  );
  await svgToPng(
    buildWordmarkIconSVG(512, { maskable: true }),
    path.join(PUBLIC_DIR, 'icon-512-maskable.png'),
  );

  // OG image
  await svgToPng(
    buildOGImageSVG(),
    path.join(PUBLIC_DIR, 'og-image.png'),
  );

  // Email header logo (240×68 @2x, display 120×34)
  await svgToPng(
    buildEmailLogoSVG(),
    path.join(PUBLIC_DIR, 'email-logo.png'),
  );

  // Clean up tmp files
  [tmp16, tmp32, tmp48].forEach(f => fs.unlinkSync(f));

  console.log('\nAll assets written to public/\n');
}

main().catch(err => { console.error(err); process.exit(1); });
