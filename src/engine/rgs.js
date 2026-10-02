const crypto = require('node:crypto');
const { cryptoRng } = require('./rng');
const { getMechanic, RESULT_KEYS } = require('./mechanics');
const { evaluatePaylines } = require('./core/evaluate');
const { scatterPositions, scatterResult } = require('./core/free-spins');

/**
 * RGS core: dispatches a spin to the game's mechanic and applies the
 * platform rules shared by every game:
 *   - free spins state (count, win multiplier, retriggers, spin cap)
 *   - feature buy (forced trigger)
 *   - max win cap (game.max_win_x x bet, per spin and per free-spins round)
 */
class RgsEngine {
  static calculateSpin({
    game,
    betAmount,
    activeState = null,
    customStopPositions = null,
    rng = cryptoRng(),
    buyFeature = false
  }) {
    const mechanic = getMechanic(game.mechanic);

    const isFreeSpin = !!(activeState && activeState.free_spins_left > 0);
    const bet = isFreeSpin ? (activeState.free_spins_bet || betAmount) : betAmount;
    const fsCfg = game.free_spins || null;
    const bonus = parseBonus(activeState && activeState.active_bonus_data);

    let res = mechanic.play(game, {
      bet,
      rng,
      inFreeSpins: isFreeSpin,
      forceTrigger: !isFreeSpin && buyFeature,
      customStops: customStopPositions,
      bonus
    });

    // Guaranteed hit (Social Casino / Cosmic mode / operator setting)
    const guaranteedWin = !!(game.guaranteed_win || (game.rtp_profile && game.rtp_profile >= 1000) || (activeState && activeState.guaranteed_win));
    if (guaranteedWin && !customStopPositions && !buyFeature && res.win === 0 && (!res.free_spins_awarded || res.free_spins_awarded <= 0)) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const candidate = mechanic.play(game, {
          bet,
          rng,
          inFreeSpins: isFreeSpin,
          forceTrigger: false,
          customStops: null,
          bonus
        });
        if (candidate.win > 0 || (candidate.free_spins_awarded && candidate.free_spins_awarded > 0)) {
          res = candidate;
          break;
        }
      }
      if (res.win === 0 && (!res.free_spins_awarded || res.free_spins_awarded <= 0) && game.free_spins) {
        const candidate = mechanic.play(game, {
          bet,
          rng,
          inFreeSpins: isFreeSpin,
          forceTrigger: true,
          customStops: null,
          bonus
        });
        if (candidate.win > 0 || (candidate.free_spins_awarded && candidate.free_spins_awarded > 0)) {
          res = candidate;
        }
      }
    }

    // Free-spins global win multiplier (lines / ways games)
    const winMultiplier = isFreeSpin && fsCfg && fsCfg.win_multiplier ? fsCfg.win_multiplier : 1;
    if (winMultiplier > 1) {
      res.winning_lines.forEach((w) => { w.payout *= winMultiplier; });
      if (res.scatter_win) res.scatter_win.payout *= winMultiplier;
      res.win *= winMultiplier;
    }

    // Max-win cap
    const maxWin = Math.floor((game.max_win_x || 5000) * bet);
    const alreadyWon = isFreeSpin ? (activeState.free_spins_total_win || 0) : 0;
    let totalWin = res.win;
    let maxWinReached = false;
    if (alreadyWon + totalWin >= maxWin) {
      totalWin = Math.max(0, maxWin - alreadyWon);
      maxWinReached = true;
    }

    // Free-spins bookkeeping
    const awarded = res.free_spins_awarded || 0;
    let remaining = isFreeSpin ? activeState.free_spins_left - 1 + awarded : awarded;
    if (fsCfg && fsCfg.max_spins) remaining = Math.min(remaining, fsCfg.max_spins);
    if (maxWinReached) remaining = 0;

    const newBonus = remaining > 0 ? { ...(res.bonus || {}) } : {};

    return {
      round_id: crypto.randomUUID(),
      mechanic: game.mechanic,
      matrix: res.matrix,
      final_matrix: res.final_matrix || res.matrix,
      stop_positions: res.stop_positions,
      winning_lines: res.winning_lines,
      scatter_win: res.scatter_win,
      ...Object.fromEntries(RESULT_KEYS.map((k) => [k, res[k] || null])),
      total_win: totalWin,
      max_win_reached: maxWinReached,
      is_free_spin: isFreeSpin,
      bet,
      free_spins_awarded: awarded,
      free_spins: {
        is_free_spin: isFreeSpin,
        remaining: Math.max(0, remaining),
        awarded,
        multiplier: fsCfg && fsCfg.win_multiplier ? fsCfg.win_multiplier : 1,
        total_multiplier: res.bonus ? res.bonus.total_multiplier || 0 : 0
      },
      bonus: newBonus
    };
  }

  // Backwards-compatible helpers (used by tests / tools)
  static evaluatePaylines(game, matrix, bet) {
    return evaluatePaylines(game, matrix, bet);
  }

  static evaluateScatters(game, matrix, bet, { inFreeSpins = false } = {}) {
    return scatterResult(game, scatterPositions(matrix), bet, inFreeSpins);
  }
}

function parseBonus(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

module.exports = { RgsEngine };
