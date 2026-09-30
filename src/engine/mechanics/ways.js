const { spinReels, stripsFor } = require('../core/reels');
const { cellColumns, evaluateWays, totalPayout } = require('../core/evaluate');
const { scatterPositions, scatterResult } = require('../core/free-spins');
const { weightedTable } = require('../rng');
const { buildReelStrips } = require('./lines');

/**
 * Ways to win (243 on 5x3, 1024 on 5x4 …): a symbol pays on adjacent reels from reel 1, any row.
 * Win = coin value x paytable x number of ways. In free spins WILDs can carry a multiplier
 * (free_spins.wild_multipliers, weighted) that multiplies every way through them.
 */
/** Ways wins of a rectangular screen; wildMults = { "r,c": multiplier } of WILD cells. */
function evaluate(game, matrix, bet, wildMults = {}) {
  return evaluateWays(game, cellColumns(matrix, (r, c) => wildMults[`${r},${c}`] || 1), bet / game.bet_multiplier);
}

function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, customStops = null }) {
  const { matrix, stops } = spinReels(stripsFor(game, inFreeSpins), game.rows_count, rng, {
    forceScatters: forceTrigger ? game.free_spins.trigger : 0,
    customStops
  });

  const wildMults = {};
  const wm = game.free_spins && game.free_spins.wild_multipliers;
  if (inFreeSpins && wm) {
    const table = weightedTable(wm);
    matrix.forEach((row, r) => row.forEach((s, c) => { if (s === 'WILD') wildMults[`${r},${c}`] = Number(table.pick(rng)); }));
  }

  const winning_lines = evaluate(game, matrix, bet, wildMults);
  const scatter_win = scatterResult(game, scatterPositions(matrix), bet, inFreeSpins);
  return {
    matrix,
    stop_positions: stops,
    winning_lines,
    scatter_win,
    wild_multipliers: wildMults,
    win: totalPayout(winning_lines) + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: scatter_win ? scatter_win.free_spins_awarded : 0
  };
}

module.exports = {
  id: 'ways',
  label: 'Ways',
  paytableUnit: 'x coin value per way',
  waysCount: (raw) => Math.pow(raw.rows_count, raw.reels_count),
  build: buildReelStrips,
  play,
  evaluate
};
