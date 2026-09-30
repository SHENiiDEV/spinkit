const { weightedTable } = require('../rng');
const { totalPayout } = require('../core/evaluate');
const { collapseGrid, winPositions, copyGrid } = require('../core/cascade');
const { scatterPositions, scatterResult, forceScattersAnywhere, bracket } = require('../core/free-spins');
const { buildWeights } = require('./tumble');

/**
 * "Match lines" mechanic — big grid, straight lines of 3+ identical symbols anywhere
 * (horizontal or vertical) pay, explode and cascade, with a growing win multiplier.
 * Reusable for any grid size:
 *
 *   mechanic: 'matchlines'
 *   reels_count: 7, rows_count: 8
 *   paytable: { SYM: { 3: .., 4: .., ..., 8: .. } }   line length -> pay (x TOTAL bet)
 *   weights / fs_weights                               symbol weights for new cells
 *   multiplier: { base: { start: 1, step: 1 }, fs: { start: 2, step: 2 }, max: 1024 }
 *   free_spins: { trigger: 4, spins: { 4: 10, 5: 12, 6: 15, 7: 20 }, retrigger_min: 3, retrigger_spins: 5, persistent_multiplier: true }
 *
 * Rules
 *  - 3+ identical symbols next to each other in a row or in a column form a line and pay
 *    (longer lines pay more; a symbol can be part of a horizontal and a vertical line).
 *    WILD substitutes every paying symbol except SCATTER.
 *  - All winning symbols explode, the rest fall, new symbols drop in; repeat while there are lines.
 *  - Every cascade win is multiplied by the current multiplier; after each winning cascade the
 *    multiplier grows by `step` (base x1, x2, x3 …; free spins x2, x4, x6 …) up to `max`.
 *    Base game: resets every spin. Free spins: kept for the whole feature.
 *  - SCATTERs never explode; counted on the final grid.
 */

const MAX_CASCADES = 100;

function findLines(game, grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const min = game.min_line || 3;
  const lines = [];
  const payers = Object.keys(game.paytable).filter((s) => s !== 'SCATTER' && s !== 'WILD');
  for (const sym of payers) {
    const hit = (r, c) => grid[r][c] === sym || grid[r][c] === 'WILD';
    // horizontal runs
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        if (!hit(r, c)) { c++; continue; }
        let e = c;
        while (e + 1 < cols && hit(r, e + 1)) e++;
        const cells = [];
        for (let x = c; x <= e; x++) cells.push([r, x]);
        if (cells.length >= min && cells.some(([y, x]) => grid[y][x] === sym)) lines.push({ symbol: sym, dir: 'h', positions: cells });
        c = e + 1;
      }
    }
    // vertical runs
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        if (!hit(r, c)) { r++; continue; }
        let e = r;
        while (e + 1 < rows && hit(e + 1, c)) e++;
        const cells = [];
        for (let y = r; y <= e; y++) cells.push([y, c]);
        if (cells.length >= min && cells.some(([y, x]) => grid[y][x] === sym)) lines.push({ symbol: sym, dir: 'v', positions: cells });
        r = e + 1;
      }
    }
  }
  return lines;
}

/** Pay of the longest bracket reached by a line of `len` symbols. */
const payFor = (game, sym, len) => bracket(game.paytable[sym], len);

function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, bonus = {} }) {
  const rows = game.rows_count;
  const cols = game.reels_count;
  const table = weightedTable(inFreeSpins && game.fs_symbol_weights ? game.fs_symbol_weights : game.symbol_weights);
  const fs = game.free_spins || {};
  const M = game.multiplier || { base: { start: 1, step: 1 }, fs: { start: 2, step: 2 }, max: 1024 };
  const mode = inFreeSpins ? M.fs : M.base;
  const persistent = inFreeSpins && fs.persistent_multiplier;
  let mult = persistent && bonus.multiplier ? bonus.multiplier : mode.start;
  const startMult = mult;

  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => table.pick(rng)));
  if (forceTrigger && fs.trigger) forceScattersAnywhere(grid, fs.trigger, rng);

  const initial = copyGrid(grid);
  const cascades = [];
  const allWins = [];
  let total = 0;
  for (let step = 0; step < MAX_CASCADES; step++) {
    const wins = findLines(game, grid)
      .map((l) => {
        const pay = payFor(game, l.symbol, l.positions.length);
        return { line_index: null, symbol: l.symbol, dir: l.dir, count: l.positions.length, positions: l.positions, multiplier: pay, win_multiplier: mult, payout: Math.floor(bet * pay * mult) };
      })
      .filter((w) => w.multiplier > 0)
      .sort((a, b) => b.payout - a.payout);
    const stepWin = totalPayout(wins);
    cascades.push({ grid: copyGrid(grid), wins, win: stepWin, win_multiplier: mult });
    if (!wins.length) break;
    total += stepWin;
    wins.forEach((w) => allWins.push({ ...w, tumble: step }));
    grid = collapseGrid(grid, winPositions(wins), () => table.pick(rng)); // SCATTERs never win, so never explode
    mult = Math.min(M.max, mult + mode.step);
  }

  // SCATTERs only award free spins here (no scatter pays)
  const scatter_win = scatterResult(game, scatterPositions(grid), bet, inFreeSpins);
  const awarded = scatter_win ? scatter_win.free_spins_awarded : 0;

  return {
    matrix: initial,
    final_matrix: grid,
    stop_positions: [],
    cascades,
    winning_lines: allWins,
    scatter_win,
    win_multiplier: { start: startMult, end: mult },
    bonus: { multiplier: persistent ? mult : M.fs.start },
    win: total + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: awarded
  };
}

module.exports = {
  id: 'matchlines',
  label: 'Match Lines',
  paytableUnit: 'x total bet',
  build: buildWeights,
  play,
  publicConfig: (game) => ({ win_multiplier_rules: game.multiplier || null, min_line: game.min_line || 3 }),
  features: (game) => ({ cascades: true, win_multiplier: game.multiplier }),
  findLines
};
