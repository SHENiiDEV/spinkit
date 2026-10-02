const { weightedTable } = require('../rng');
const { collapseGrid, winPositions, copyGrid } = require('../core/cascade');
const { scatterPositions, scatterResult, forceScattersAnywhere, bracket } = require('../core/free-spins');
const { totalPayout } = require('../core/evaluate');
const { buildWeights } = require('./tumble');
const { isCosmic, enhanceCosmicClusters } = require('../core/cosmic');

/**
 * "Clusters" mechanic — cluster pays + tumble + multiplier spots (reusable for any grid).
 *
 *   mechanic: 'clusters'
 *   paytable: { SYM: { 5: 0.2, 6: 0.3, ..., 15: 10 } }   cluster size -> pay (x TOTAL bet), highest bracket reached
 *   weights / fs_weights:                                 symbol weights for new cells
 *   spots: { max: 1024 }                                  multiplier cap of one spot
 *   free_spins: { trigger: 3, spins: { 3: 10, 4: 12, ... }, sticky_spots: true, ... }
 *
 * Rules
 *  - 5+ identical symbols connected horizontally / vertically form a cluster and pay.
 *  - Winning symbols explode, the rest fall down, new symbols drop in; repeat while there are wins.
 *  - Every cell where a winning symbol exploded gets MARKED. When a winning symbol explodes on an
 *    already marked cell, the cell becomes a MULTIPLIER SPOT x2; every further hit doubles it
 *    (x4, x8 … up to spots.max).
 *  - A cluster win is multiplied by the SUM of the multiplier spots under the cluster (spots as they
 *    were before that tumble).
 *  - Base game: spots reset after the spin. Free spins (sticky_spots): spots stay for the whole feature.
 *  - SCATTERs never explode; counted on the final grid: `trigger`+ award free spins (retrigger in FS).
 */

const MAX_TUMBLES = 80;

function makeTable(game, inFreeSpins) {
  return weightedTable(inFreeSpins && game.fs_symbol_weights ? game.fs_symbol_weights : game.symbol_weights);
}

/** All clusters of 5+ (or game.min_cluster) connected identical paying symbols. */
function findClusters(game, grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const min = game.min_cluster || 5;
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (seen[r][c]) continue;
      const sym = grid[r][c];
      seen[r][c] = true;
      if (sym === 'SCATTER' || !game.paytable[sym]) continue;
      const stack = [[r, c]];
      const cells = [];
      while (stack.length) {
        const [y, x] = stack.pop();
        cells.push([y, x]);
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= rows || nx >= cols || seen[ny][nx] || grid[ny][nx] !== sym) continue;
          seen[ny][nx] = true;
          stack.push([ny, nx]);
        }
      }
      if (cells.length >= min) out.push({ symbol: sym, positions: cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]) });
    }
  }
  return out;
}

const payFor = (game, symbol, size) => bracket(game.paytable[symbol], size);


/** Spot value after one more hit: 0 (none) -> 1 (marked) -> 2 -> 4 -> ... -> max */
function hitSpot(v, max) {
  if (!v) return 1;
  if (v === 1) return 2;
  return Math.min(v * 2, max);
}

function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, bonus = {} }) {
  const rows = game.rows_count;
  const cols = game.reels_count;
  const table = makeTable(game, inFreeSpins);
  const draw = () => table.pick(rng);
  const maxSpot = (game.spots && game.spots.max) || 1024;
  const fs = game.free_spins || {};

  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, draw));
  if (forceTrigger && fs.trigger) forceScattersAnywhere(grid, fs.trigger, rng);

  // spots: { 'r,c': value } — kept between free spins when sticky
  const spots = inFreeSpins && fs.sticky_spots && bonus.spots ? { ...bonus.spots } : {};
  if (isCosmic(game)) enhanceCosmicClusters(game, grid, rng, spots);
  const initial = copyGrid(grid);
  const cascades = [];
  const allWins = [];
  let totalWin = 0;

  for (let step = 0; step < MAX_TUMBLES; step++) {
    const spotsBefore = { ...spots };
    const wins = findClusters(game, grid).map((cl) => {
      const pay = payFor(game, cl.symbol, cl.positions.length);
      let spotSum = 0;
      const spotCells = [];
      for (const [r, c] of cl.positions) {
        const v = spots[`${r},${c}`] || 0;
        if (v >= 2) {
          spotSum += v;
          spotCells.push([r, c, v]);
        }
      }
      const m = Math.max(1, spotSum);
      return { line_index: null, symbol: cl.symbol, count: cl.positions.length, positions: cl.positions, multiplier: pay, spot_multiplier: m, spot_cells: spotCells, payout: Math.floor(bet * pay * m) };
    }).filter((w) => w.multiplier > 0).sort((a, b) => b.payout - a.payout);

    const stepWin = totalPayout(wins);
    const removed = winPositions(wins);
    for (const k of removed) spots[k] = hitSpot(spots[k], maxSpot);
    cascades.push({ grid: copyGrid(grid), wins, win: stepWin, spots_before: spotsBefore, spots_after: { ...spots } });
    if (!wins.length) break;
    totalWin += stepWin;
    wins.forEach((w) => allWins.push({ ...w, tumble: step }));
    grid = collapseGrid(grid, removed, draw);
  }

  const scatter_win = scatterResult(game, scatterPositions(grid), bet, inFreeSpins);
  return {
    matrix: initial,
    final_matrix: grid,
    stop_positions: [],
    cascades,
    winning_lines: allWins,
    scatter_win,
    spots,
    bonus: { spots: inFreeSpins && fs.sticky_spots ? spots : {} }, // a base-game trigger starts the feature clean
    win: totalWin + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: scatter_win ? scatter_win.free_spins_awarded : 0
  };
}

module.exports = {
  id: 'clusters',
  label: 'Cluster Pays',
  paytableUnit: 'x total bet',
  build: buildWeights,
  play,
  publicConfig: (game) => ({ spots: game.spots || null, min_cluster: game.min_cluster || 5 }),
  features: (game) => ({
    tumble: true,
    cascades: true,
    cluster_pays: true,
    multiplier_spots: { max: (game.spots && game.spots.max) || 1024, sticky_in_free_spins: !!(game.free_spins && game.free_spins.sticky_spots) }
  }),
  findClusters,
  hitSpot
};
