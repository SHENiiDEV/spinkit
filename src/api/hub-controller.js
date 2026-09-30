const { dbService } = require('../db/database');
const { GAMES_CATALOG, toIconFile, collectionOf } = require('../games/catalog');
const { CURRENCY, REFILL_AMOUNT } = require('../config');
const gameService = require('../services/game-service');
const merchants = require('../services/merchants');
const jackpots = require('../services/jackpots');
const { wrap } = require('./rgs-controller');

const DEMO_MERCHANT = 1;

/**
 * Legacy /api/v1 endpoints power the public demo lobby. They are unauthenticated,
 * so they only ever touch players of the built-in demo merchant (#1).
 * Set SPINKIT_PUBLIC_DEMO=0 to switch them off completely in production.
 */
function demoOnly(userId) {
  if (process.env.SPINKIT_PUBLIC_DEMO === '0') {
    return { status: 403, body: { error: 'PUBLIC_DEMO_DISABLED', message: 'Public demo endpoints are disabled. Use the Merchant API v2.' } };
  }
  const u = dbService.findUser(Number(userId));
  if (u && u.merchant_id !== DEMO_MERCHANT) {
    return { status: 403, body: { error: 'FORBIDDEN', message: 'This player belongs to another merchant. Use the Merchant API v2.' } };
  }
  return null;
}

class HubController {
  /**
   * POST /api/v1/games/launch
   * Generates a launch URL with a cryptographically secure session token.
   */
  static handleLaunch(reqBody, hostHeader) {
    const { user_id, game_id } = reqBody;
    if (!user_id || !game_id) {
      return { status: 400, body: { error: 'INVALID_REQUEST', message: 'user_id and game_id are required' } };
    }
    if (!GAMES_CATALOG[game_id]) {
      return { status: 404, body: { error: 'GAME_NOT_FOUND', message: `Game ${game_id} does not exist` } };
    }
    const denied = demoOnly(user_id);
    if (denied) return denied;
    const player = dbService.getUser(user_id);
    const host = hostHeader || 'localhost:3000';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return wrap(() => {
      const r = gameService.launch({ merchant: merchants.get(DEMO_MERCHANT), player, gameId: game_id, baseUrl: `${protocol}://${host}`, ttlMinutes: 60, actor: 'public-lobby' });
      return { status: 'success', launch_url: r.launch_url, token: r.token, game_slug: game_id, user_id: player.id, expires_at: r.expires_at };
    });
  }

  /**
   * GET /api/v1/games
   * Returns the games switched on for the demo merchant (Back Office → Games), with rich metadata.
   */
  static handleGetGames() {
    const settings = merchants.gameSettingsMap(DEMO_MERCHANT);
    const list = Object.values(GAMES_CATALOG).filter((g) => merchants.isGameEnabled(DEMO_MERCHANT, g.id, settings)).map(g => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      tagline: g.tagline,
      category: g.category,
      collection: collectionOf(g),
      rtp: g.rtp,
      reels_count: g.reels_count,
      rows_count: g.rows_count,
      paylines_count: g.paylines_count,
      min_bet: g.min_bet,
      max_bet: g.max_bet,
      default_bet: g.default_bet,
      theme: g.theme,
      mechanic: g.mechanic,
      volatility: g.volatility,
      max_win_x: g.max_win_x,
      ways_count: g.ways_count,
      hit_rate: g.hit_rate,
      fs_frequency: g.fs_frequency,
      has_free_spins: !!g.free_spins,
      has_feature_buy: !!(g.free_spins && g.free_spins.buy),
      symbol_icons: Object.values(g.symbols).map(s => s.icon),
      symbol_files: Object.values(g.symbols).filter(s => s.icon_file).map(s => s.icon_file),
      cover_files: [...new Set([toIconFile(g.theme.icon), ...Object.values(g.symbols).filter(s => s.icon_file && !s.isScatter).map(s => s.icon_file)].filter(Boolean))].slice(0, 3),
      skin_of: g.skin_of || null
    }));

    return {
      status: 200,
      body: {
        status: 'success',
        currency: CURRENCY,
        jackpots: jackpots.ticker(merchants.get(DEMO_MERCHANT)),
        games: list
      }
    };
  }

  /**
   * POST /api/v1/user/refill
   * Infinite credits replenishment button.
   */
  static handleRefill(reqBody) {
    const userId = reqBody.user_id || 49102;
    const amount = Math.min(Number(reqBody.amount) || REFILL_AMOUNT, REFILL_AMOUNT * 10);
    const denied = demoOnly(userId);
    if (denied) return denied;

    const user = dbService.refillBalance(userId, amount);
    return {
      status: 200,
      body: {
        status: 'success',
        user_id: user.id,
        balance: user.balance,
        added: amount,
        message: 'Balance refilled with infinite credits'
      }
    };
  }

  /**
   * GET /api/v1/user/balance
   */
  static handleGetBalance(userId) {
    const id = Number(userId) || 49102;
    const denied = demoOnly(id);
    if (denied) return denied;
    const user = dbService.getUser(id);
    return {
      status: 200,
      body: {
        user_id: user.id,
        username: user.username,
        balance: user.balance,
        currency: CURRENCY
      }
    };
  }

  /**
   * GET /api/v1/transactions
   */
  static handleGetTransactions(userId, limit = 20) {
    if (userId) {
      const denied = demoOnly(userId);
      if (denied) return denied;
    }
    const txs = userId
      ? dbService.getRecentTransactions(Number(userId), limit)
      : dbService.db.prepare(`SELECT t.*, g.name AS game_name FROM rgs_transactions t LEFT JOIN games g ON t.game_id = g.id
          WHERE t.merchant_id = ${DEMO_MERCHANT} ORDER BY t.id DESC LIMIT ?`).all(Math.min(200, Number(limit) || 30)).map((r) => dbService.mapTx(r));

    return {
      status: 200,
      body: {
        status: 'success',
        count: txs.length,
        transactions: txs
      }
    };
  }
}

module.exports = {
  HubController
};
