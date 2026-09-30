const { spinReels, stripsFor } = require('../core/reels');
const { evaluatePaylines, totalPayout } = require('../core/evaluate');
const { scatterPositions, scatterResult } = require('../core/free-spins');
const { buildStrips } = require('../strips');

/**
 * Classic fixed paylines, left to right on reel strips.
 * Paytable values are multiples of the LINE bet (total bet / bet_multiplier);
 * scatter pays are multiples of the TOTAL bet and pay anywhere.
 */
function play(game, { bet, rng, inFreeSpins = false, forceTrigger = false, customStops = null }) {
  const { matrix, stops } = spinReels(stripsFor(game, inFreeSpins), game.rows_count, rng, {
    forceScatters: forceTrigger ? game.free_spins.trigger : 0,
    customStops
  });
  const winning_lines = evaluatePaylines(game, matrix, bet);
  const scatter_win = scatterResult(game, scatterPositions(matrix), bet, inFreeSpins);
  return {
    matrix,
    stop_positions: stops,
    winning_lines,
    scatter_win,
    win: totalPayout(winning_lines) + (scatter_win ? scatter_win.payout : 0),
    free_spins_awarded: scatter_win ? scatter_win.free_spins_awarded : 0
  };
}

/** Deterministic reel strips from symbol counts (shared by every strip-based mechanic). */
function buildReelStrips(game, raw, { seed }) {
  const opts = { spaced: ['SCATTER'], minGap: raw.rows_count, stacks: raw.stacks || {} };
  game.reel_strips = buildStrips(raw.reels, { ...opts, seed });
  if (raw.fs_reels) game.fs_reel_strips = buildStrips(raw.fs_reels, { ...opts, seed: seed + 1 });
}

module.exports = {
  id: 'lines',
  label: 'Paylines',
  paytableUnit: 'x line bet',
  build: buildReelStrips,
  play,
  buildReelStrips
};
