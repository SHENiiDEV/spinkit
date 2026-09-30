#!/usr/bin/env node
/**
 * Generates the painted artwork of the AI skins (src/games/skins/ai.js) with the OpenAI Images API.
 *
 *   node scripts/gen-ai-art.js --list                    # skins and whether their art exists
 *   node scripts/gen-ai-art.js aztec_titans              # one game
 *   node scripts/gen-ai-art.js --kind megaways           # all games of a kind (megaways, clusters, holdwin, matchlines, titans)
 *   node scripts/gen-ai-art.js --all                     # everything that is still missing
 *   add --dry to only print the prompts, --force to regenerate existing pictures
 *
 * Needs OPENAI_API_KEY in the environment or in SpinKit/.env (never commit it). Optional:
 *   OPENAI_IMAGE_MODEL   (default gpt-image-1)      OPENAI_IMAGE_QUALITY (cabinet/Wild/giant, default high)
 *   OPENAI_SYMBOL_QUALITY (single symbols, default medium: low | medium | high)
 *
 * Output: art-src/<id>/*.png + brief.json. Then `python3 scripts/import-ai-art.py <id|--all>` cuts the
 * pictures into game assets; the game appears in the lobby after a server restart.
 */
const fs = require('node:fs');
const path = require('node:path');
const { KINDS, SKINS } = require('../src/games/skins/ai');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'art-src');

// ---------------------------------------------------------------- env
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------------------------------------------------------- prompts
const STYLE = 'premium modern online slot game art, painterly 2.5D illustration, rich cinematic lighting, highly detailed, vibrant colors';

const itemText = (skin, id, n) => {
  if (id.startsWith('_spare')) return `${n}. a small themed decorative treasure item`;
  if (/^(A|K|Q|J|10|9)$/.test(id)) return `${n}. the card symbol "${id}" as chunky ornate carved letters in the game's theme with small themed decorations`;
  const name = skin.sym[id] || id;
  if (id === 'WILD') return `${n}. ${name.replace(/\s*Wild$/i, '')} with a golden plate that reads "WILD"`;
  if (id === 'SCATTER') return `${n}. ${name}, glowing, the most special-looking symbol`;
  return `${n}. ${name}`;
};

function pieces(skin) {
  const kind = KINDS[skin.kind];
  const colors = `main colors ${skin.look.accent} and ${skin.look.bg1}`;
  const out = [];
  out.push({
    file: 'cabinet.png', size: '1536x1024', background: 'opaque', role: 'stage',
    prompt: `${STYLE}. Slot machine cabinet, front view, filling the whole image. Background: ${skin.scene}. In the center an ornate themed frame around ${kind.cabinet}; the reel window is LARGE (about two thirds of the image height) and EMPTY: plain very dark, almost black panel, no symbols, no grid lines, nothing inside. The frame is slim. At the top center a compact bold game logo that reads "${skin.name.toUpperCase()}" in chunky ornate letters matching the theme, no trademark symbols. ${colors}. No other text, no UI buttons, nothing in front of the reel window.`
  });
  // one picture per symbol (sheets of many symbols come back in unpredictable layouts)
  for (const sh of kind.sheets) {
    for (const id of sh.ids) {
      if (id.startsWith('_')) continue;
      const what = itemText(skin, id, '').replace(/^\.\s*/, '');
      out.push({
        file: `sym_${id.toLowerCase()}.png`, size: '1024x1024', background: 'transparent', role: 'symbol', id, quality: process.env.OPENAI_SYMBOL_QUALITY || 'medium',
        prompt: `${STYLE}. One single slot game symbol, centered, filling most of the square image: ${what}. Part of a slot game themed "${skin.name}" (${skin.scene}). Transparent background, no frame, no card, no text or letters except where asked. ${colors}.`
      });
    }
  }
  if (kind.strip) {
    out.push({
      file: 'wild.png', size: '1024x1536', background: 'transparent', role: 'strip',
      prompt: `${STYLE}. One tall ${skin.sym.WILD.replace(/\s*Wild$/i, '')} pillar filling the whole image from top to bottom, front view, themed "${skin.name}" (${skin.scene}), made of repeating carved segments with glowing details. Exactly in the vertical center a glowing golden plate with the word "WILD". Transparent background, no frame, no other text. ${colors}.`
    });
  }
  if (kind.card) {
    out.push({
      file: 'giant.png', size: '1024x1536', background: 'transparent', role: 'card',
      prompt: `${STYLE}. One tall vertical portrait card (about 2:5) centered in the image, in an ornate themed frame: ${skin.sym.SHARK}, epic and powerful, filling the card, background inside the card: ${skin.scene}. The frame has an EMPTY round medallion at the bottom center. Transparent background outside the card, no text. ${colors}.`
    });
  }
  return out;
}

// ---------------------------------------------------------------- OpenAI
async function generate(piece, dest) {
  const body = {
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: piece.prompt,
    size: piece.size,
    quality: piece.quality || process.env.OPENAI_IMAGE_QUALITY || 'high',
    background: piece.background,
    output_format: 'png',
    n: 1
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data && data.data[0] && data.data[0].b64_json) {
      fs.writeFileSync(dest, Buffer.from(data.data[0].b64_json, 'base64'));
      return;
    }
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 401 || res.status === 403 || attempt === 3) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

async function pool(jobs, size) {
  let i = 0;
  let failed = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      try {
        await job();
      } catch (e) {
        failed++;
        console.error(`✗ ${e.message}`);
      }
    }
  }));
  return failed;
}

// ---------------------------------------------------------------- main
async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : null);
  const assetsReady = (id) => fs.existsSync(path.join(ROOT, 'public/games', id, 'assets/stage.json'));

  if (flag('list') || !args.length) {
    for (const s of SKINS) {
      const dir = path.join(SRC, s.id);
      const have = pieces(s).filter((p) => fs.existsSync(path.join(dir, p.file))).length;
      console.log(`${s.kind.padEnd(10)} ${s.id.padEnd(30)} ${assetsReady(s.id) ? 'in game' : `pictures ${have}/${pieces(s).length}`}`);
    }
    if (!args.length) console.log('\nUsage: node scripts/gen-ai-art.js <id> | --kind <kind> | --all  [--dry] [--force]');
    return;
  }
  const kind = opt('kind');
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--kind');
  const skins = SKINS.filter((s) => (flag('all') ? true : kind ? s.kind === kind : ids.includes(s.id)));
  if (!skins.length) throw new Error('No matching skins (see --list)');

  const jobs = [];
  for (const s of skins) {
    if (assetsReady(s.id) && !flag('force')) {
      console.log(`- ${s.id}: already in the game, skipped (--force to redo)`);
      continue;
    }
    const dir = path.join(SRC, s.id);
    fs.mkdirSync(dir, { recursive: true });
    const list = pieces(s);
    fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify({ id: s.id, kind: s.kind, windows: KINDS[s.kind].windows || null, pieces: list }, null, 2));
    for (const p of list) {
      const dest = path.join(dir, p.file);
      if (flag('dry')) { console.log(`\n# ${s.id}/${p.file} (${p.size}, ${p.background})\n${p.prompt}`); continue; }
      if (fs.existsSync(dest) && !flag('force')) continue;
      jobs.push(async () => {
        const t0 = Date.now();
        await generate(p, dest);
        console.log(`✔ ${s.id}/${p.file}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      });
    }
  }
  if (flag('dry')) return;
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set (put it into SpinKit/.env)');
  console.log(`${jobs.length} picture(s) to generate for ${skins.length} game(s)…`);
  const failed = await pool(jobs, Number(process.env.OPENAI_CONCURRENCY || 3));
  console.log(failed ? `${failed} failed — run the same command again to retry them` : 'done. Next: python3 scripts/import-ai-art.py --all');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
