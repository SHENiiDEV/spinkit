const { weightedTable } = require('../rng');
const { collapseGrid, winPositions, copyGrid } = require('../core/cascade');
const { scatterPositions, scatterResult } = require('../core/free-spins');
const { totalPayout } = require('../core/evaluate');
const { isCosmic, enhanceCosmicTumble } = require('../core/cosmic');

/**
 * "Tumble" / pay-anywhere mechanic.
 *
 *  - 8+ identical symbols ANYWHERE on the grid pay (paytable brackets, x TOTAL bet).
 *  - Winning symbols explode, the rest fall, new symbols drop in; repeat while there are wins.
 *  - Multiplier symbols ("M<value>", e.g. "M25") stay on the grid; at the end of a winning
 *    sequence their values are added together and multiply the tumble win.
 *      mode "per_spin":   multiplier = sum on screen (resets every spin)
 *      mode "accumulate": in free spins the sum is added to a running total multiplier
 *  - SCATTERs never explode; counted on the final grid.
 */

const MAX_TUMBLES = 60;

function makeTables(game, inFreeSpins) {
  const weights = inFreeSpins && game.fs_symbol_weights ? game.fs_symbol_weights : game.symbol_weights;
  const m = game.multipliers || null;
  const multChance = m ? (inFreeSpins ? m.chance_fs : m.chance_base) || 0 : 0; // per 10,000 cells
  return {
    symbols: weightedTable(weights),
    multValues: m ? weightedTable(inFreeSpins && m.values_fs ? m.values_fs : m.values) : null,
    multChance
  };
}

function newCell(tables, rng) {
  if (tables.multChance && rng.int(10000) < tables.multChance) return 'M' + tables.multValues.pick(rng);
  return tables.symbols.pick(rng);
}

function isMult(s) {
  return typeof s === 'string' && s[0] === 'M' && s.length > 1 && !isNaN(Number(s.slice(1)));
}

function evaluateGrid(game, grid, bet) {
  const counts = {};
  grid.forEach((row, r) => row.forEach((s, c) => {
    if (s === 'SCATTER' || isMult(s)) return;
    (counts[s] = counts[s] || []).push([r, c]);
  }));
  const wins = [];
  for (const [symbol, positions] of Object.entries(counts)) {
    const pays = game.paytable[symbol];
    if (!pays) continue;
    let mult = 0;
    for (const [threshold, value] of Object.entries(pays)) if (positions.length >= Number(threshold)) mult = value;
    if (mult > 0) wins.push({ line_index: null, symbol, count: positions.length, positions, multiplier: mult, payout: Math.floor(bet * mult) });
  }
  return wins.sort((a, b) => b.payout - a.payout);
}

/** Puts at least `need` scatters on the grid (feature buy), one per column. */
function forceScatterColumns(grid, need, rng) {
  const rows = grid.length;
  const cols = grid[0].length;
  let have = grid.flat().filter((s) => s === 'SCATTER').length;
  const colsPool = [...Array(cols).keys()];
  while (have < need && colsPool.length) {
    const c = colsPool.splice(rng.int(colsPool.length), 1)[0];
    if (grid.some((row) => row[c] === 'SCATTER')) continue;
    grid[rng.int(rows)][c] = 'SCATTER';
    have++;
  }
}

function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, bonus = {} }) {
  const rows = game.rows_count;
  const cols = game.reels_count;
  const tables = makeTables(game, inFreeSpins);
  const draw = () => newCell(tables, rng);

  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, draw));
  if (forceTrigger) forceScatterColumns(grid, game.free_spins.trigger, rng);
  if (isCosmic(game)) enhanceCosmicTumble(game, grid, rng);

  const initial = copyGrid(grid);
  const cascades = [];
  const allWins = [];
  let tumbleWin = 0;
  for (let step = 0; step < MAX_TUMBLES; step++) {
    const wins = evaluateGrid(game, grid, bet);
    const stepWin = totalPayout(wins);
    cascades.push({ grid: copyGrid(grid), wins, win: stepWin });
    if (!wins.length) break;
    tumbleWin += stepWin;
    wins.forEach((w) => allWins.push({ ...w, tumble: step }));
    grid = collapseGrid(grid, winPositions(wins), draw);
  }

  // multipliers on the final grid
  const multPositions = [];
  const multValues = [];
  grid.forEach((row, r) => row.forEach((s, c) => {
    if (isMult(s)) {
      multPositions.push([r, c]);
      multValues.push(Number(s.slice(1)));
    }
  }));
  const multSum = multValues.reduce((a, b) => a + b, 0);
  const m = game.multipliers || {};
  let appliedMultiplier = 1;
  let totalMultiplier = bonus.total_multiplier || 0;
  if (tumbleWin > 0 && multSum > 0) {
    if (inFreeSpins && m.mode === 'accumulate') {
      totalMultiplier += multSum;
      appliedMultiplier = totalMultiplier;
    } else {
      appliedMultiplier = multSum;
    }
  } else if (tumbleWin > 0 && inFreeSpins && m.mode === 'accumulate' && totalMultiplier > 0) {
    appliedMultiplier = totalMultiplier;
  }

  const scatter_win = scatterResult(game, scatterPositions(grid), bet, inFreeSpins);
  return {
    matrix: initial,
    final_matrix: grid,
    stop_positions: [],
    cascades,
    winning_lines: allWins,
    scatter_win,
    tumble_win: tumbleWin,
    multipliers: { positions: multPositions, values: multValues, sum: multSum, applied: appliedMultiplier, total: totalMultiplier },
    bonus: { total_multiplier: totalMultiplier },
    win: tumbleWin * appliedMultiplier + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: scatter_win ? scatter_win.free_spins_awarded : 0
  };
}

/** Symbol weights instead of strips. Shared by every grid-refill mechanic. */
function buildWeights(game, raw) {
  game.symbol_weights = raw.weights;
  game.fs_symbol_weights = raw.fs_weights || raw.weights;
}

module.exports = {
  id: 'tumble',
  label: 'Tumble / Pay Anywhere',
  paytableUnit: 'x total bet',
  build: buildWeights,
  play,
  publicConfig: (game) => ({
    multipliers: game.multipliers
      ? { mode: game.multipliers.mode, in_base_game: (game.multipliers.chance_base || 0) > 0, values: Object.keys(game.multipliers.values).map(Number).sort((a, b) => a - b) }
      : null
  }),
  features: () => ({ tumble: true, cascades: true }),
  evaluateGrid,
  isMult,
  buildWeights
};
