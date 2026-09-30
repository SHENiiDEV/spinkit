const { weightedTable, seededRng } = require('../rng');
const { evaluateWays, totalPayout } = require('../core/evaluate');
const { scatterPositions, scatterResult } = require('../core/free-spins');

/**
 * "Giants" mechanic — ways-to-win on any grid with tall (giant) symbols
 * and sticky multiplier giants in free spins. Reusable for any game:
 *
 *   mechanic: 'giants'
 *   giants:   { PRINCESS: { height: 3 }, WILD: { height: 3 } }   symbols that only exist as tall blocks
 *   reels / fs_reels: per-reel counts; for giant symbols the count is the number of BLOCKS on the strip
 *   giants:   { WILD: { height: 'reel' } }                        a "reel giant": always fills its whole reel
 *   reel_heights: [3, 4, 5, 6, 5, 4, 3]                          optional: rows of every reel (default rows_count);
 *                                                               the matrix is rows_count (= max) tall, cells below
 *                                                               a shorter reel are null
 *   free_spins.sticky_giants: true
 *   free_spins.sticky_multipliers: { 2: 60, 3: 40 }             random multiplier for every new sticky giant,
 *                                   or per symbol: { WILD: { 1: 300, ..., 500: 1 }, PRINCESS: { 2: 60, 3: 40 } }
 *
 * Rules
 *  - Ways pay left to right (min 3 adjacent reels). A giant counts as ONE symbol on its reel,
 *    so it never multiplies ways by its height; its weight is its multiplier (1 when it has none).
 *  - The WILD giant substitutes every paying symbol except SCATTER.
 *  - Free spins: a giant that lands FULLY visible (all its rows inside the window) becomes sticky
 *    for the rest of the feature and receives a random multiplier (e.g. x2 or x3).
 *    Giants that land partly outside the window pay normally for that spin but do not stick.
 *  - A reel giant ({ height: 'reel' }) sits on the strip as one cell; when it shows anywhere on
 *    its reel it grows over the whole reel (its height = that reel's height), so it is always
 *    fully visible and always becomes sticky in free spins.
 *  - Every way that passes through a multiplier giant is multiplied by it; several multiplier
 *    giants in one way multiply together.
 */

// ------------------------------------------------------------------ strips
/**
 * Builds strips as { syms: [], parts: [] } where parts[i] is the row index inside a giant
 * block (0 = top) or -1 for normal symbols. Scatters are kept `rows` apart.
 */
function buildGiantStrips(reelCounts, giants, { seed = 11, rows = 5, heights = null } = {}) {
  return reelCounts.map((counts, reelIndex) => {
    const reelRows = heights ? heights[reelIndex] : rows;
    for (let attempt = 0; attempt < 200; attempt++) {
      const rng = seededRng(seed * 7919 + reelIndex * 104729 + attempt * 31);
      const chunks = [];
      for (const [sym, n] of Object.entries(counts)) {
        const h = giants[sym] && giants[sym].height !== 'reel' ? giants[sym].height : 1; // reel giants: 1 cell on the strip
        for (let i = 0; i < n; i++) chunks.push({ sym, h });
      }
      for (let i = chunks.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
      }
      const syms = [];
      const parts = [];
      for (const c of chunks) {
        for (let k = 0; k < c.h; k++) {
          syms.push(c.sym);
          parts.push(c.h > 1 ? k : -1);
        }
      }
      if (scattersSpaced(syms, reelRows)) return { syms, parts };
    }
    throw new Error(`Could not build strip ${reelIndex}: too many scatters for ${reelRows} rows`);
  });
}

function scattersSpaced(syms, rows) {
  const idx = [];
  syms.forEach((s, i) => { if (s === 'SCATTER') idx.push(i); });
  for (let a = 0; a < idx.length; a++) {
    const b = (a + 1) % idx.length;
    if (idx.length < 2) break;
    let d = idx[b] - idx[a];
    if (d <= 0) d += syms.length;
    if (d < rows) return false;
  }
  return true;
}

// ------------------------------------------------------------------ window
/** Rows of every reel (reel_heights, or rows_count for all). */
const reelHeights = (game) => game.reel_heights || Array(game.reels_count).fill(game.rows_count);

/** Height of a giant on a reel of `reelRows` rows. */
const giantHeight = (def, reelRows) => (def.height === 'reel' ? reelRows : def.height);

function readWindow(strips, stops, rows, heights = null) {
  const cols = strips.length;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(heights ? null : ''));
  const parts = Array.from({ length: rows }, () => Array(cols).fill(-1));
  for (let c = 0; c < cols; c++) {
    const s = strips[c];
    const L = s.syms.length;
    const h = heights ? heights[c] : rows;
    for (let r = 0; r < h; r++) {
      const i = (stops[c] + r) % L;
      matrix[r][c] = s.syms[i];
      parts[r][c] = s.parts[i];
    }
  }
  return { matrix, parts };
}

function spinStops(strips, heights, rng, { forceScatters = 0 } = {}) {
  const stops = strips.map((s) => rng.int(s.syms.length));
  if (forceScatters > 0) {
    const pool = strips.map((s, c) => c).filter((c) => strips[c].syms.includes('SCATTER'));
    const chosen = [];
    while (chosen.length < forceScatters && pool.length) chosen.push(pool.splice(rng.int(pool.length), 1)[0]);
    for (const c of chosen) {
      const s = strips[c];
      const idx = [];
      s.syms.forEach((x, i) => { if (x === 'SCATTER') idx.push(i); });
      const at = idx[rng.int(idx.length)];
      stops[c] = (at - rng.int(heights[c]) + s.syms.length) % s.syms.length;
    }
  }
  return stops;
}

// ------------------------------------------------------------------ play
function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, bonus = {} }) {
  const rows = game.rows_count;
  const cols = game.reels_count;
  const giantDefs = game.giants || {};
  const fsCfg = game.free_spins || {};
  const strips = inFreeSpins && game.fs_reel_strips ? game.fs_reel_strips : game.reel_strips;
  const H = reelHeights(game);
  const stops = spinStops(strips, H, rng, { forceScatters: forceTrigger ? fsCfg.trigger : 0 });
  const { matrix, parts } = readWindow(strips, stops, rows, game.reel_heights ? H : null);

  // 0) reel giants grow over their whole reel
  for (let c = 0; c < cols; c++) {
    let grow = null;
    for (let r = 0; r < H[c] && !grow; r++) if (giantDefs[matrix[r][c]] && giantDefs[matrix[r][c]].height === 'reel') grow = matrix[r][c];
    if (grow) for (let r = 0; r < H[c]; r++) { matrix[r][c] = grow; parts[r][c] = r; }
  }

  // 1) sticky giants from previous free spins overwrite their cells
  const owner = Array.from({ length: rows }, () => Array(cols).fill(null));
  const sticky = inFreeSpins && Array.isArray(bonus.sticky) ? bonus.sticky.map((g) => ({ ...g })) : [];
  sticky.forEach((g, gi) => {
    for (let k = 0; k < g.height; k++) {
      const r = g.top + k;
      if (r < 0 || r >= H[g.reel]) continue;
      matrix[r][g.reel] = g.symbol;
      parts[r][g.reel] = k;
      owner[r][g.reel] = `s${gi}`;
    }
  });

  // 2) giants that landed this spin (cells not covered by sticky giants)
  const landed = [];
  for (let c = 0; c < cols; c++) {
    const seen = new Map();
    for (let r = 0; r < H[c]; r++) {
      if (owner[r][c] || parts[r][c] < 0) continue;
      const top = r - parts[r][c];
      const k = `${top}`;
      if (!seen.has(k)) {
        const g = { reel: c, top, height: giantDefs[matrix[r][c]] ? giantHeight(giantDefs[matrix[r][c]], H[c]) : 1, symbol: matrix[r][c], rows: [] };
        seen.set(k, g);
        landed.push(g);
      }
      seen.get(k).rows.push(r);
    }
  }

  const multTables = {};
  const multTableFor = (sym) => {
    if (!(sym in multTables)) multTables[sym] = stickyTable(fsCfg.sticky_multipliers, sym);
    return multTables[sym];
  };
  const newSticky = [];
  for (const g of landed) {
    g.full = g.top >= 0 && g.top + g.height - 1 < H[g.reel] && g.rows.length === g.height;
    g.multiplier = 1;
    if (inFreeSpins && fsCfg.sticky_giants && g.full) {
      const table = multTableFor(g.symbol);
      g.multiplier = table ? Number(table.pick(rng)) : 1;
      g.sticky = true;
      g.new_sticky = true;
      newSticky.push({ reel: g.reel, top: g.top, height: g.height, symbol: g.symbol, multiplier: g.multiplier });
      g.rows.forEach((r) => { owner[r][g.reel] = `n${newSticky.length - 1}`; });
    }
  }

  const giants = [
    ...sticky.map((g) => ({ ...g, rows: range(g.top, g.height, H[g.reel]), full: true, sticky: true, new_sticky: false })),
    ...landed.map(({ rows: rr, ...g }) => ({ ...g, rows: rr, sticky: !!g.sticky, new_sticky: !!g.new_sticky }))
  ];

  // 3) objects per reel for ways evaluation: a giant is ONE object weighted by its multiplier
  const columns = Array.from({ length: cols }, () => []);
  const giantAt = new Map();
  giants.forEach((g) => g.rows.forEach((r) => giantAt.set(`${r},${g.reel}`, g)));
  for (let c = 0; c < cols; c++) {
    const done = new Set();
    for (let r = 0; r < H[c]; r++) {
      const g = giantAt.get(`${r},${c}`);
      if (!g) {
        columns[c].push({ symbol: matrix[r][c], weight: 1, positions: [[r, c]] });
      } else if (!done.has(g)) {
        done.add(g);
        const weight = g.multiplier || 1;
        columns[c].push({ symbol: g.symbol, weight, positions: g.rows.map((rr) => [rr, c]), meta: weight > 1 ? { reel: c, top: g.top, multiplier: weight } : null });
      }
    }
  }
  const coin = bet / game.bet_multiplier;
  const winning_lines = evaluateWays(game, columns, coin, { decorate: (win, metas) => ({ giant_multipliers: metas }) });

  // 4) scatters
  const scatter_win = scatterResult(game, scatterPositions(matrix), bet, inFreeSpins);
  const awarded = scatter_win ? scatter_win.free_spins_awarded : 0;

  return {
    matrix,
    stop_positions: stops,
    giants,
    winning_lines,
    scatter_win,
    win: totalPayout(winning_lines) + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: awarded,
    bonus: { sticky: [...sticky, ...newSticky] }
  };
}

/**
 * sticky_multipliers is either one table for every giant ({ 2: 60, 3: 40 }) or a table per
 * symbol ({ WILD: { 1: 300, ..., 500: 1 }, PRINCESS: { 2: 60, 3: 40 } }). Weights, not percents.
 */
function stickyTable(cfg, sym) {
  if (!cfg) return null;
  if (cfg[sym] && typeof cfg[sym] === 'object') return weightedTable(cfg[sym]);
  const flat = Object.keys(cfg).every((k) => /^\d+$/.test(k));
  return flat ? weightedTable(cfg) : null;
}

/** All multiplier values a symbol can get (for clients / docs). */
function stickyValues(cfg, sym) {
  if (!cfg) return [];
  const t = cfg[sym] && typeof cfg[sym] === 'object' ? cfg[sym] : (Object.keys(cfg).every((k) => /^\d+$/.test(k)) ? cfg : {});
  return Object.keys(t).map(Number).sort((a, b) => a - b);
}

function range(top, h, rows) {
  const out = [];
  for (let r = top; r < top + h; r++) if (r >= 0 && r < rows) out.push(r);
  return out;
}

function build(game, raw, { seed }) {
  const opts = { rows: raw.rows_count, heights: raw.reel_heights || null };
  game.reel_strips = buildGiantStrips(raw.reels, raw.giants, { ...opts, seed });
  if (raw.fs_reels) game.fs_reel_strips = buildGiantStrips(raw.fs_reels, raw.giants, { ...opts, seed: seed + 1 });
}

function publicFreeSpins(game) {
  const fs = game.free_spins || {};
  if (!fs.sticky_multipliers) return {};
  const ids = Object.keys(game.giants || {});
  return {
    sticky_multipliers: [...new Set(ids.flatMap((id) => stickyValues(fs.sticky_multipliers, id)))].sort((a, b) => a - b),
    sticky_multipliers_by_symbol: Object.fromEntries(ids.map((id) => [id, stickyValues(fs.sticky_multipliers, id)]))
  };
}

module.exports = {
  id: 'giants',
  label: 'Giant Symbols',
  paytableUnit: 'x coin value per way',
  waysCount: (raw) => (raw.reel_heights ? raw.reel_heights.reduce((a, b) => a * b, 1) : Math.pow(raw.rows_count, raw.reels_count)),
  build,
  play,
  publicConfig: (game) => ({ giants: game.giants || null, ...(game.reel_heights ? { reel_heights: game.reel_heights } : {}) }),
  publicFreeSpins,
  features: (game) => ({ giant_symbols: game.giants ? Object.keys(game.giants) : null }),
  buildGiantStrips,
  readWindow,
  stickyValues
};
