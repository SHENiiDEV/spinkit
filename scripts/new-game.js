#!/usr/bin/env node
/**
 * Scaffolds a new game from the reference template of a mechanic.
 *
 *   npm run new-game -- --id desert_gold --name "Desert Gold" --mechanic lines
 *   npm run new-game -- --id desert_gold --name "Desert Gold" --from pharaoh_riches
 *   npm run new-game -- --list
 *
 * Writes src/games/definitions/<id>.js (a full, editable copy of the template's math, symbols
 * and theme, without the template's artwork), registers it in definitions/index.js, then builds
 * and plays it to check that it works. Next steps are printed at the end.
 */
const fs = require('node:fs');
const path = require('node:path');

process.env.SPINKIT_QUIET = '1';
const RAW_GAMES = require('../src/games/definitions');
const kit = require('../src/games/kit');
const CALIBRATION = require('../src/games/calibration.json');
const { MECHANICS } = require('../src/engine/mechanics');

const DEFS = path.join(__dirname, '../src/games/definitions');

/** The reference game of every mechanic (the first template using it). */
const REFERENCE = {};
for (const g of RAW_GAMES) if (!REFERENCE[g.mechanic]) REFERENCE[g.mechanic] = g.id;

const args = process.argv.slice(2);
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- JS source serializer
const IDENT = /^[A-Za-z_$][\w$]*$/;
const keyOf = (k) => (IDENT.test(k) || /^\d+$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`);
const PAYLINES = Object.entries(kit).filter(([k]) => k.startsWith('LINES_'));

function lit(v, indent = '') {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v !== 'object') return String(v);
  const inner = indent + '  ';
  const parts = Array.isArray(v) ? v.map((x) => lit(x, inner)) : Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${keyOf(k)}: ${lit(x, inner)}`);
  const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
  if (!parts.length) return open + close;
  const flat = Array.isArray(v) ? `[${parts.join(', ')}]` : `{ ${parts.join(', ')} }`;
  if (flat.length + indent.length <= 110 && !flat.includes('\n')) return flat;
  return `${open}\n${parts.map((p) => inner + p).join(',\n')}\n${indent}${close}`;
}

/** reels: same counts on every reel -> reels(n, base, overrides) */
function reelsSource(list) {
  const base = { ...list[0] };
  for (const r of list) for (const k of Object.keys(base)) if (r[k] !== base[k]) delete base[k];
  const overrides = {};
  list.forEach((r, i) => {
    const diff = {};
    for (const [k, v] of Object.entries(r)) if (base[k] !== v) diff[k] = v;
    if (Object.keys(diff).length) overrides[i] = diff;
  });
  // only when it rebuilds every reel exactly (key order matters for the strip builder)
  if (list.some((r, i) => JSON.stringify({ ...base, ...(overrides[i] || {}) }) !== JSON.stringify(r))) return null;
  return `reels(${list.length}, ${lit(base, '  ')}${Object.keys(overrides).length ? `, ${lit(overrides, '  ')}` : ''})`;
}

function gameSource(game, template) {
  const used = new Set();
  const fields = Object.entries(game).map(([k, v]) => {
    let src;
    if (k === 'paylines') {
      const named = PAYLINES.find(([, lines]) => JSON.stringify(lines) === JSON.stringify(v));
      if (named) { src = named[0]; used.add(named[0]); }
    }
    if ((k === 'reels' || k === 'fs_reels') && Array.isArray(v) && v.every((r) => !Array.isArray(r))) {
      const r = reelsSource(v);
      if (r) { src = r; used.add('reels'); }
    }
    return `  ${keyOf(k)}: ${src || lit(v, '  ')}`;
  });
  return `// ${game.name} — ${MECHANICS[game.mechanic].label}
// Scaffolded from ${template} (npm run new-game). Edit freely: symbols, paytable, reels/weights,
// free spins and theme. Recalibrate after math changes: node scripts/simulate.js --game ${game.id} --calibrate --write
${used.size ? `\nconst { ${[...used].join(', ')} } = require('../kit');\n` : ''}
module.exports = {
${fields.join(',\n')}
};
`;
}

// ---------------------------------------------------------------- strip template artwork
function withoutArt(raw, id) {
  const g = JSON.parse(JSON.stringify(raw));
  const t = g.theme || {};
  ['logo', 'background', 'cover', 'stage', 'plainSymbols', 'symbolScale'].forEach((k) => delete t[k]);
  if (t.frame === 'none') t.frame = 'gold';
  if (t.reelBg && t.reelBg.every((c) => /rgba\(0,\s*0,\s*0,\s*0\)/.test(c))) t.reelBg = ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.65)'];
  for (const s of Object.values(g.symbols)) ['image', 'tall_image', 'plain', 'badge_y'].forEach((k) => delete s[k]);
  // symbols fall back to Twemoji art once the template's images are gone: every glyph needs an icon file
  const { toIconFile } = require('../src/games/build');
  const icons = path.join(__dirname, '../public/games/assets/icons');
  const missing = Object.values(g.symbols).filter((s) => s.glyph && !fs.existsSync(path.join(icons, toIconFile(s.glyph))));
  if (missing.length) console.warn(`! no Twemoji icon for ${missing.map((s) => `${s.id} (${s.glyph})`).join(', ')} — pick another glyph or add an image`);
  const leftover = JSON.stringify(g).match(/\/games\/[a-z0-9_]+\/assets[^"]*/g);
  if (leftover) console.warn(`! template artwork still referenced: ${leftover.join(', ')}`);
  delete g.calibration_from;
  g.id = id;
  return g;
}

// ---------------------------------------------------------------- main
if (args.includes('--list') || !args.length) {
  console.log('Mechanics and their reference templates:');
  for (const [m, tpl] of Object.entries(REFERENCE)) console.log(`  ${m.padEnd(11)} ${MECHANICS[m].label.padEnd(22)} ${tpl}`);
  console.log('\nUsage: npm run new-game -- --id <game_id> --name "Game Name" (--mechanic <mechanic> | --from <template_id>)');
  process.exit(0);
}

const id = opt('id');
const name = opt('name');
const from = opt('from') || REFERENCE[opt('mechanic')];
if (!id || !/^[a-z][a-z0-9_]{2,40}$/.test(id)) fail('--id must be snake_case (a-z, 0-9, _), e.g. desert_gold');
if (!name) fail('--name is required');
if (!from) fail(`--mechanic must be one of: ${Object.keys(REFERENCE).join(', ')} (or use --from <template_id>)`);
const template = RAW_GAMES.find((g) => g.id === from);
if (!template) fail(`Unknown template ${from}`);
const file = path.join(DEFS, `${id}.js`);
if (fs.existsSync(file) || RAW_GAMES.some((g) => g.id === id)) fail(`Game ${id} already exists`);

const game = withoutArt(template, id);
game.name = name;
const words = name.toUpperCase().split(' ');
game.theme.title = words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [words[0], ''];
game.tagline = opt('tagline') || template.tagline;
if (opt('category')) game.category = opt('category');
// start from the template's calibrated math (same paytable and reels -> about the same RTP)
const cal = CALIBRATION[from] || {};
if (cal.pay_scale) game.pay_scale = cal.pay_scale;
if (cal.buy_cost && game.free_spins && game.free_spins.buy) game.free_spins.buy_cost = cal.buy_cost;

fs.writeFileSync(file, gameSource(game, from));
const indexFile = path.join(DEFS, 'index.js');
const index = fs.readFileSync(indexFile, 'utf8');
fs.writeFileSync(indexFile, index.replace(/\n\];\s*$/, `\n  require('./${id}'),\n];\n`));

// ---------------------------------------------------------------- check: build + play
try {
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
  const { GAMES_CATALOG } = require('../src/games/catalog');
  const { RgsEngine } = require('../src/engine/rgs');
  const { seededRng } = require('../src/engine/rng');
  const g = GAMES_CATALOG[id];
  const rng = seededRng(1);
  let bet = 0;
  let won = 0;
  for (let i = 0; i < 3000; i++) {
    const r = RgsEngine.calculateSpin({ game: g, betAmount: g.default_bet, rng });
    bet += g.default_bet;
    won += r.total_win;
  }
  console.log(`✔ src/games/definitions/${id}.js created from ${from} (${g.mechanic}, ${g.reels_count}x${g.rows_count}), registered in the lobby`);
  console.log(`  quick check: 3,000 base spins OK (base-game return ~${((won / bet) * 100).toFixed(0)}%; template RTP ${cal.rtp || 'n/a'}, recalibrate after edits)`);
} catch (e) {
  fs.unlinkSync(file);
  fs.writeFileSync(indexFile, index);
  fail(`The new game does not build: ${e.message} (nothing was written)`);
}

console.log(`
Next steps
  1. Edit src/games/definitions/${id}.js — symbols, paytable, reels/weights, free spins, theme colours.
  2. Calibrate the RTP:   node scripts/simulate.js --game ${id} --calibrate --write
  3. Art (optional):      drop images into public/games/${id}/assets/ and reference them in the theme
                          (theme.stage / symbol.image), or add a painter in scripts/art/games/${id}.js
                          and run node scripts/gen-art.js ${id}
  4. Restart the server — the game is in the lobby and the merchant API.`);
