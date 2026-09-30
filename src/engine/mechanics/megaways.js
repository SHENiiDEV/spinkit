const { weightedTable } = require('../rng');
const { evaluateWays, totalPayout } = require('../core/evaluate');
const { collapseColumns, winPositions } = require('../core/cascade');
const { scatterResult } = require('../core/free-spins');

/**
 * "Megaways" — variable reel heights + ways + cascades + growing win multiplier.
 *
 *   reels_count: 6, rows_count: 7            rows_count = max height of a reel
 *   heights / fs_heights: { 2: 10, ..., 7: 10 }        weights of each reel height (per reel, per spin)
 *   reel_weights / fs_reel_weights: [ {SYM: w}, ... ]  symbol weights per reel (e.g. no WILD on reels 1 and 6)
 *   paytable: { SYM: { 3: .., 4: .., 5: .., 6: .. } }  x coin value per way
 *   free_spins: { ..., persistent_multiplier: true }
 *
 *  - Every reel shows 2..7 symbols; ways = product of the reel heights (up to 117,649 on 6 reels).
 *  - Pays left to right on adjacent reels (3+), any position; WILD substitutes all but SCATTER.
 *  - Winning symbols disappear, the rest drop, new ones fill the gaps (reel heights stay).
 *  - Win multiplier starts at x1 and grows +1 after every winning cascade; base game resets
 *    every spin, free spins (persistent_multiplier) keep it for the whole feature.
 */

const MAX_CASCADES = 60;

function tables(game, inFreeSpins) {
  const heights = weightedTable(inFreeSpins && game.fs_heights ? game.fs_heights : game.heights);
  const reelWeights = inFreeSpins && game.fs_reel_weights ? game.fs_reel_weights : game.reel_weights;
  return { heights, reels: reelWeights.map((w) => weightedTable(w)) };
}

const toObjects = (cols) => cols.map((col, c) => col.map((symbol, r) => ({ symbol, weight: 1, positions: [[r, c]] })));

/** Ways wins on columns of different heights, x the cascade multiplier. */
function evaluate(game, cols, coin, mult) {
  return evaluateWays(game, toObjects(cols), coin, { scale: mult, decorate: () => ({ win_multiplier: mult }) });
}

/** Rows x cols matrix (null where a reel is shorter) for generic consumers. */
function pad(cols, rows) {
  return Array.from({ length: rows }, (_, r) => cols.map((col) => (r < col.length ? col[r] : null)));
}

function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, bonus = {} }) {
  const T = tables(game, inFreeSpins);
  const fs = game.free_spins || {};
  const nReels = game.reels_count;
  const heights = Array.from({ length: nReels }, () => Number(T.heights.pick(rng)));
  let cols = heights.map((h, c) => Array.from({ length: h }, () => T.reels[c].pick(rng)));

  if (forceTrigger && fs.trigger) {
    const have = new Set();
    cols.forEach((col, c) => { if (col.includes('SCATTER')) have.add(c); });
    const pool = [...Array(nReels).keys()].filter((c) => !have.has(c));
    while (have.size < fs.trigger && pool.length) {
      const c = pool.splice(rng.int(pool.length), 1)[0];
      cols[c][rng.int(cols[c].length)] = 'SCATTER';
      have.add(c);
    }
  }

  const coin = bet / game.bet_multiplier;
  const persistent = inFreeSpins && fs.persistent_multiplier;
  let mult = persistent ? bonus.win_multiplier || 1 : 1;
  const startMult = mult;
  const initial = cols.map((c) => c.slice());
  const cascades = [];
  const allWins = [];
  let total = 0;

  for (let step = 0; step < MAX_CASCADES; step++) {
    const wins = evaluate(game, cols, coin, mult);
    const stepWin = totalPayout(wins);
    cascades.push({ reels: cols.map((c) => c.slice()), grid: pad(cols, game.rows_count), wins, win: stepWin, win_multiplier: mult });
    if (!wins.length) break;
    total += stepWin;
    wins.forEach((w) => allWins.push({ ...w, tumble: step }));
    cols = collapseColumns(cols, winPositions(wins), (c) => T.reels[c].pick(rng));
    mult += 1;
  }

  const positions = [];
  cols.forEach((col, c) => col.forEach((s, r) => { if (s === 'SCATTER') positions.push([r, c]); }));
  const scatter_win = scatterResult(game, positions, bet, inFreeSpins);

  return {
    matrix: pad(initial, game.rows_count),
    final_matrix: pad(cols, game.rows_count),
    stop_positions: [],
    reels: initial,
    final_reels: cols,
    heights,
    ways: heights.reduce((a, b) => a * b, 1),
    cascades,
    winning_lines: allWins,
    scatter_win,
    win_multiplier: { start: startMult, end: mult },
    bonus: { win_multiplier: persistent ? mult : 1 },
    win: total + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: scatter_win ? scatter_win.free_spins_awarded : 0
  };
}

module.exports = {
  id: 'megaways',
  label: 'Megaways',
  paytableUnit: 'x coin value per way',
  waysCount: (raw) => Math.pow(raw.rows_count, raw.reels_count), // maximum
  build: () => {},
  play,
  features: () => ({ megaways: true, cascades: true }),
  evaluate
};
