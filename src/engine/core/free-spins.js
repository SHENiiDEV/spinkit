/**
 * Scatter counting, scatter pays and free-spins awards — shared by every mechanic.
 *
 *   free_spins.trigger          scatters needed in the base game
 *   free_spins.spins            number, or { scatters: spins } (highest bracket reached counts)
 *   free_spins.retrigger_min    scatters needed during free spins (default: trigger)
 *   free_spins.retrigger_spins  spins added on a retrigger (default: the `spins` table)
 *   paytable.SCATTER            { count: pay } in x TOTAL bet (highest bracket reached counts)
 */

/** Positions of every SCATTER in a rectangular matrix (rows x cols). */
function scatterPositions(matrix) {
  const out = [];
  matrix.forEach((row, r) => row.forEach((s, c) => { if (s === 'SCATTER') out.push([r, c]); }));
  return out;
}

/** Highest bracket of `table` ({ threshold: value }) reached by `n`; 0 when none. */
function bracket(table, n) {
  let best = 0;
  for (const [k, v] of Object.entries(table || {})) if (n >= Number(k)) best = v;
  return best;
}

function spinsFor(fs, count) {
  return typeof fs.spins === 'object' ? bracket(fs.spins, count) : fs.spins || 0;
}

/** Free spins awarded for `count` scatters (0 when the feature is not triggered). */
function freeSpinsAwarded(game, count, inFreeSpins) {
  const fs = game.free_spins;
  if (!fs || !fs.trigger) return 0;
  if (inFreeSpins) return count >= (fs.retrigger_min || fs.trigger) ? fs.retrigger_spins || spinsFor(fs, count) : 0;
  return count >= fs.trigger ? spinsFor(fs, count) : 0;
}

/**
 * The scatter result of a spin: pays (x total bet) and free spins. null when there is neither.
 * `positions` are the scatter cells ([row, col]) on the final screen.
 */
function scatterResult(game, positions, bet, inFreeSpins) {
  const count = positions.length;
  const multiplier = bracket(game.paytable.SCATTER, count);
  const awarded = freeSpinsAwarded(game, count, inFreeSpins);
  if (!multiplier && !awarded) return null;
  return { symbol: 'SCATTER', count, positions, multiplier, payout: Math.floor(bet * multiplier), free_spins_awarded: awarded };
}

/** Feature buy on refill grids: turns random cells into SCATTERs until `need` are on screen. */
function forceScattersAnywhere(grid, need, rng) {
  const rows = grid.length;
  const cols = grid[0].length;
  let have = grid.flat().filter((s) => s === 'SCATTER').length;
  const pool = [...Array(rows * cols).keys()];
  while (have < need && pool.length) {
    const i = pool.splice(rng.int(pool.length), 1)[0];
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (grid[r][c] === 'SCATTER') continue;
    grid[r][c] = 'SCATTER';
    have++;
  }
}

module.exports = { scatterPositions, bracket, spinsFor, freeSpinsAwarded, scatterResult, forceScattersAnywhere };
