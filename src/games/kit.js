/**
 * Game-definition kit: everything a file in src/games/definitions needs to describe a slot.
 *
 *   const { royal, icon, wild, scatter, reels, LINES_5x3_20 } = require('../kit');
 *   module.exports = { id, name, mechanic, reels_count, rows_count, symbols, paytable, ... };
 *
 * See docs/ARCHITECTURE.md for the fields every mechanic reads.
 */

// ---------------------------------------------------------------- paylines (row index per reel)
const LINES_5x3_20 = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 2, 2, 2, 1], [1, 0, 0, 0, 1], [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0]
];
const LINES_3x3_5 = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
const LINES_5x4_25 = [
  [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [0, 0, 0, 0, 0], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3], [1, 0, 0, 0, 1], [2, 3, 3, 3, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3],
  [1, 2, 3, 2, 1], [2, 1, 0, 1, 2], [1, 1, 0, 1, 1], [2, 2, 3, 2, 2], [0, 0, 1, 0, 0],
  [3, 3, 2, 3, 3], [1, 2, 2, 2, 1], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [3, 2, 3, 2, 3],
  [1, 0, 1, 0, 1], [2, 3, 2, 3, 2], [0, 0, 1, 2, 3], [3, 3, 2, 1, 0], [1, 2, 1, 2, 1]
];

// ---------------------------------------------------------------- symbols
const royal = (id, color, name) => ({ id, name: name || id, kind: 'royal', label: id, color });
const icon = (id, name, glyph, color, extra = {}) => ({ id, name, kind: 'icon', glyph, color, ...extra });
const wild = (name, glyph, color, extra = {}) => ({ id: 'WILD', name, kind: 'wild', glyph, color, isWild: true, ...extra });
const scatter = (name, glyph, color, extra = {}) => ({ id: 'SCATTER', name, kind: 'scatter', glyph, color, isScatter: true, ...extra });

/** Same counts on every reel, with optional per-reel overrides. */
function reels(n, base, overrides = {}) {
  return Array.from({ length: n }, (_, i) => ({ ...base, ...(overrides[i] || {}) }));
}

/**
 * A new game with the SAME math as `template` and new looks (a "skin"):
 * paytable, reels, features and RTP calibration are the template's 1:1.
 *
 *   module.exports = reskin(require('./tiki_titans'), {
 *     id: 'aztec_titans', name: 'Aztec Titans', category: 'aztec',
 *     theme: { accent: '#...', title: ['AZTEC', 'TITANS'], stage: { ... } },   // merged into the template's theme
 *     symbols: { WILD: { name: 'Jaguar Totem Wild' }, SHARK: { name: 'Serpent God' } }  // per symbol id: new name/colour/...
 *   });
 *
 * Asset paths /games/<template>/assets/... become /games/<id>/assets/... with the same file names,
 * so a skin only needs its own folder with the same pictures (see scripts/import-art.py).
 */
function reskin(template, { id, name, tagline, category, theme = {}, symbols = {} }) {
  const raw = JSON.parse(JSON.stringify(template).split(`/games/${template.id}/assets/`).join(`/games/${id}/assets/`));
  Object.assign(raw, { id, name, skin_of: template.skin_of || template.id, calibration_from: template.calibration_from || template.id });
  if (tagline) raw.tagline = tagline;
  if (category) raw.category = category;
  raw.theme = { ...raw.theme, ...theme };
  for (const [sid, over] of Object.entries(symbols)) {
    if (!raw.symbols[sid]) throw new Error(`reskin ${id}: ${template.id} has no symbol ${sid}`);
    raw.symbols[sid] = { ...raw.symbols[sid], ...over };
  }
  return raw;
}

module.exports = { LINES_5x3_20, LINES_3x3_5, LINES_5x4_25, royal, icon, wild, scatter, reels, reskin };
