const gameService = require('../services/game-service');
const { ApiError } = require('../services/errors');

/** Wraps a service call into the { status, body } shape used by the router and tests. */
function wrap(fn) {
  try {
    return { status: 200, body: fn() };
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: e.toBody() };
    console.error(e);
    return { status: 500, body: { status: 'error', error: 'INTERNAL_ERROR', message: 'Internal server error' } };
  }
}

/**
 * Game-client API (called by the slot running in the player's browser).
 * Authenticated by the one-off session token from the launch URL.
 */
class RgsController {
  static handleInit({ token } = {}) {
    return wrap(() => gameService.init(token));
  }

  static handleSpin({ token, bet_amount: bet, buy_feature: buy } = {}) {
    return wrap(() => gameService.spin(token, bet, buy));
  }

  static handleRefill({ token } = {}) {
    return wrap(() => gameService.refill(token));
  }
}

module.exports = { RgsController, publicGameConfig: gameService.publicGameConfig, wrap };
