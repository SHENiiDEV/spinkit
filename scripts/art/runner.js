/**
 * Node side of the art pipeline: starts headless Chromium (Playwright), loads a painter
 * (browser-side drawing code) with fonts and Twemoji glyphs, and writes the pictures.
 *
 * An art module (scripts/art/games/*.js) is either
 *   - a "cabinet" module: { game, painter, stage: { width, height }, panel, fonts, glyphs, symbolSeed }
 *     where the painter defines drawStage(ctx, panel) and SYM = { ID: (ctx) => ... } (320x320 each)
 *   - or a custom module: { games: [ids], run(kit, opts) } for anything else (giant skins).
 */
const fs = require('node:fs');
const path = require('node:path');
const { toIconFile } = require('../../src/games/build');

const ROOT = path.join(__dirname, '../..');
const ICONS = path.join(ROOT, 'public/games/assets/icons');
const FONTS = path.join(ROOT, 'public/games/assets/fonts');
const assetsDir = (game) => path.join(ROOT, 'public/games', game, 'assets');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const { execSync } = require('node:child_process');
    return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

async function launch() {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  return chromium.launch(exe ? { executablePath: exe } : {});
}

const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;

/** fonts: [{ family, file, weight? }] -> @font-face css */
const fontCss = (fonts) => fonts.map((f) => `@font-face{font-family:"${f.family}";${f.weight ? `font-weight:${f.weight};` : ''}src:url(${dataUrl(path.join(FONTS, f.file), 'font/woff2')}) format("woff2");}`).join('\n');

/** Twemoji SVGs as data URLs, keyed by the emoji. */
function glyphImages(glyphs) {
  const map = {};
  for (const g of glyphs) {
    const f = path.join(ICONS, toIconFile(g));
    if (!fs.existsSync(f)) throw new Error(`Missing Twemoji icon ${toIconFile(g)} for ${g}`);
    map[g] = dataUrl(f, 'image/svg+xml');
  }
  return map;
}

/** A page with the painter source, fonts and glyphs loaded (painter = string or array of strings). */
async function paintingPage(browser, { painter, fonts = [], glyphs = [] }) {
  const page = await browser.newPage();
  const src = Array.isArray(painter) ? painter.join('\n') : painter;
  await page.setContent(`<html><head><style>${fontCss(fonts)}</style></head><body><script>${src}</script></body></html>`);
  await page.evaluate(async ({ imgMap, fonts: fl }) => {
    if (typeof loadImages === 'function') await loadImages(imgMap); // eslint-disable-line no-undef
    await Promise.all(fl.map((f) => document.fonts.load(`${f.weight || ''} 64px "${f.family}"`.trim())));
  }, { imgMap: glyphImages(glyphs), fonts });
  return page;
}

/** Writes { 'file.png': dataUrl } into a directory. */
function writeImages(dir, images) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, url] of Object.entries(images)) {
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  return Object.keys(images);
}

/** Cabinet modules: stage.jpg + sym_<id>.png for every SYM entry. */
async function paintCabinet(browser, art) {
  const page = await paintingPage(browser, art);
  const images = await page.evaluate(({ panel, stage, symbolSeed }) => {
    const out = {};
    const c = document.createElement('canvas'); c.width = stage.width; c.height = stage.height;
    drawStage(c.getContext('2d'), panel); // eslint-disable-line no-undef
    out['stage.jpg'] = c.toDataURL('image/jpeg', 0.9);
    for (const id of Object.keys(SYM)) { // eslint-disable-line no-undef
      const s = document.createElement('canvas'); s.width = 320; s.height = 320;
      seed = symbolSeed + id.length; // eslint-disable-line no-undef
      SYM[id](s.getContext('2d')); // eslint-disable-line no-undef
      out[`sym_${id.toLowerCase()}.png`] = s.toDataURL('image/png');
    }
    return out;
  }, { panel: art.panel, stage: art.stage, symbolSeed: art.symbolSeed || 9 });
  await page.close();
  const files = writeImages(assetsDir(art.game), images);
  console.log(`✔ ${art.game}: ${files.join(', ')}`);
}

/**
 * Lobby cover: screenshot of the cabinet in the real client (the running server at baseUrl),
 * saved as public/games/<id>/assets/cover.jpg.
 */
async function makeCover(browser, baseUrl, gameId) {
  const r = await fetch(`${baseUrl}/api/v1/games/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: 49102, game_id: gameId }) });
  const { launch_url: url } = await r.json();
  if (!url) throw new Error(`Could not launch ${gameId} on ${baseUrl}`);
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('app').classList.contains('loading'), null, { timeout: 30000 });
  await page.evaluate(() => { const bar = document.querySelector('.bar'); if (bar) bar.style.visibility = 'hidden'; });
  await page.waitForTimeout(1200);
  const el = (await page.$('#stageArt')) || (await page.$('#reelFrame'));
  fs.mkdirSync(assetsDir(gameId), { recursive: true });
  await el.screenshot({ path: path.join(assetsDir(gameId), 'cover.jpg'), type: 'jpeg', quality: 82 });
  await page.close();
  console.log(`✔ ${gameId}: cover.jpg`);
}

module.exports = { ROOT, assetsDir, launch, paintingPage, writeImages, paintCabinet, makeCover, glyphImages, fontCss };
