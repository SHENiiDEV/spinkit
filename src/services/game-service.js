const mechanics = require('../engine/mechanics');
const crypto = require('node:crypto');
const { dbService } = require('../db/database');
const { GAMES_CATALOG, QA_RTP_RANGE } = require('../games/catalog');
const { RgsEngine } = require('../engine/rgs');
const merchants = require('./merchants');
const players = require('./players');
const jackpots = require('./jackpots');
const exclusive = require('./exclusive-service');
const { currencyInfo } = require('./currency');
const { ApiError, bad, notFound } = require('./errors');
const { REFILL_AMOUNT } = require('../config');

const db = () => dbService.db;
const SESSION_TTL_MIN = Number(process.env.SPINKIT_SESSION_TTL_MIN || 240);

function parseBonus(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Game definition as sent to the client, adapted to the merchant (RTP profile, bet limits, currency). */
function publicGameConfig(game, eff = null, merchant = null) {
  const fs = game.free_spins;
  const steps = eff ? eff.bet_steps : game.bet_steps;
  return {
    id: game.id,
    name: game.name,
    mechanic: game.mechanic,
    reels: game.reels_count,
    rows: game.rows_count,
    paylines: game.paylines || null,
    paylines_count: game.paylines_count,
    ways_count: game.ways_count,
    bet_multiplier: game.bet_multiplier,
    coin_values: steps.map((b) => b / game.bet_multiplier),
    bet_steps: steps,
    default_bet: eff ? eff.default_bet : game.default_bet,
    paytable: game.paytable,
    symbols: game.symbols,
    theme: game.theme,
    ...mechanics.publicConfig(game), // giants, spots, holdwin, multipliers, ... (null when not used)
    rtp: game.rtp,
    rtp_profile: game.rtp_profile || 96,
    volatility: game.volatility,
    max_win_x: eff ? eff.max_win_x : game.max_win_x,
    guaranteed_win: !!(eff ? eff.guaranteed_win : game.guaranteed_win),
    wild_x1000: !!(eff ? eff.wild_x1000 : game.wild_x1000),
    wild_multipliers: game.wild_multipliers ? Object.keys(game.wild_multipliers).map(Number).sort((a, b) => a - b) : null,
    free_spins: fs
      ? {
        trigger: fs.trigger,
        spins: fs.spins,
        retrigger_min: fs.retrigger_min,
        retrigger_spins: fs.retrigger_spins,
        win_multiplier: fs.win_multiplier || 1,
        wild_multipliers: fs.wild_multipliers ? Object.keys(fs.wild_multipliers).map(Number) : null,
        sticky_giants: !!fs.sticky_giants,
        sticky_spots: !!fs.sticky_spots,
        persistent_multiplier: !!fs.persistent_multiplier,
        ...mechanics.publicFreeSpins(game),
        buy_cost: fs.buy ? fs.buy_cost : null
      }
      : null,
    currency: currencyInfo(merchant ? merchant.currency : null)
  };
}

function withCap(game, maxWinX) {
  if (!maxWinX || maxWinX === game.max_win_x) return game;
  const g = Object.create(game);
  g.max_win_x = maxWinX;
  return g;
}

// ------------------------------------------------------------------ launch
/**
 * Creates a game session and returns the launch URL.
 * test: { rtp_profile, force_feature } — QA options, allowed only for players flagged as test.
 */
function launch({ merchant, player, gameId, baseUrl, ttlMinutes = SESSION_TTL_MIN, test = null, lobbyUrl = null, clientIp = null, lang = null, actor = 'api' }) {
  if (merchant.status !== 'active') throw new ApiError(403, 'MERCHANT_SUSPENDED', 'Merchant is suspended');
  if (player.status !== 'active') throw new ApiError(403, 'PLAYER_BLOCKED', 'Player is blocked');
  const game = GAMES_CATALOG[gameId];
  if (!game) throw notFound('GAME_NOT_FOUND', `Game ${gameId} does not exist`);
  const eff = merchants.effective(merchant, gameId);
  if (!eff.enabled) throw new ApiError(403, 'GAME_DISABLED', `Game ${gameId} is disabled for this merchant`);

  let rtpProfile = null;
  let testMode = false;
  let forceFeature = false;
  let guaranteedWin = false;
  let wildX1000 = false;
  if (test && (test.rtp_profile != null || test.force_feature || test.guaranteed_win || test.always_win || test.wild_x1000)) {
    if (!player.is_test) {
      throw new ApiError(403, 'TEST_PLAYER_REQUIRED', 'Session RTP overrides and forced features are only allowed for players flagged as test accounts');
    }
    testMode = true;
    if (test.rtp_profile != null && test.rtp_profile !== '') {
      const v = Number(test.rtp_profile);
      if (!(v >= QA_RTP_RANGE[0] && v <= QA_RTP_RANGE[1])) throw bad('INVALID_RTP_PROFILE', `Test RTP must be ${QA_RTP_RANGE[0]}-${QA_RTP_RANGE[1]}`);
      rtpProfile = v;
    }
    forceFeature = !!test.force_feature;
    guaranteedWin = !!(test.guaranteed_win || test.always_win || (rtpProfile && rtpProfile >= 1000));
    wildX1000 = !!(test.wild_x1000 || (rtpProfile && rtpProfile >= 1000));
  } else if (player.is_test) {
    testMode = true;
  }

  const language = merchants.validateLang(lang) || merchant.default_lang || null;
  const token = crypto.randomUUID();
  const ttl = Math.max(5, Math.min(24 * 60, Number(ttlMinutes) || SESSION_TTL_MIN));
  const { expires_at: expiresAt } = dbService.createSessionToken(token, player.id, gameId, ttl, {
    merchant_id: merchant.id, rtp_profile: rtpProfile, test_mode: testMode, force_feature: forceFeature,
    guaranteed_win: guaranteedWin, wild_x1000: wildX1000,
    lobby_url: lobbyUrl || merchant.lobby_url || null, client_ip: clientIp, lang: language
  });
  if (testMode) dbService.audit(actor, 'session.test_create', `player:${player.id}`, { game_id: gameId, rtp_profile: rtpProfile, force_feature: forceFeature, guaranteed_win: guaranteedWin, wild_x1000: wildX1000 });

  return {
    token,
    game_id: gameId,
    launch_url: `${baseUrl}/games/${game.slug}/?token=${token}${language ? `&lang=${language}` : ''}`,
    lang: language,
    expires_at: new Date(expiresAt).toISOString(),
    test_mode: testMode,
    rtp: testMode && rtpProfile ? `${rtpProfile.toFixed(2)}%` : eff.rtp
  };
}

function loadSession(token) {
  if (!token) throw new ApiError(401, 'INVALID_TOKEN', 'Token is required');
  const session = dbService.getSession(token);
  if (!session) throw new ApiError(401, 'INVALID_TOKEN', 'Session token expired or not found');
  const merchant = merchants.get(session.merchant_id || 1);
  if (!merchant || merchant.status !== 'active') throw new ApiError(403, 'MERCHANT_SUSPENDED', 'Merchant is suspended');
  const player = players.byId(session.user_id) || dbService.getUser(session.user_id);
  if (player.status !== 'active') throw new ApiError(403, 'PLAYER_BLOCKED', 'Player is blocked');
  return { session, merchant, player };
}

// ------------------------------------------------------------------ init
function init(token) {
  const { session, merchant, player } = loadSession(token);
  if (exclusive.isExclusive(GAMES_CATALOG[session.game_id])) return exclusive.init(token);
  const eff = merchants.effective(merchant, session.game_id, undefined, session);
  const gameState = dbService.getGameState(player.id, session.game_id);
  const bonus = parseBonus(gameState.active_bonus_data);
  db().prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.id);
  return {
    user: { user_id: player.id, external_id: player.external_id, username: player.username, balance: player.balance },
    game_config: publicGameConfig(eff.game, eff, merchant),
    active_state: {
      has_free_spins: gameState.free_spins_left > 0,
      free_spins_left: gameState.free_spins_left,
      free_spins_multiplier: gameState.free_spins_multiplier,
      current_bet: gameState.free_spins_bet,
      free_spins_total_win: gameState.free_spins_total_win,
      total_multiplier: bonus.total_multiplier || 0,
      sticky: gameState.free_spins_left > 0 && Array.isArray(bonus.sticky) ? bonus.sticky : [],
      spots: gameState.free_spins_left > 0 && bonus.spots ? bonus.spots : {},
      win_multiplier: gameState.free_spins_left > 0 && (bonus.win_multiplier || bonus.multiplier) ? bonus.win_multiplier || bonus.multiplier : 1
    },
    session: {
      test_mode: !!session.test_mode,
      force_feature: !!session.force_feature,
      lobby_url: session.lobby_url || null,
      refill_enabled: !!merchant.demo_refill,
      expires_at: new Date(session.expires_at).toISOString()
    },
    jackpots: jackpots.ticker(merchant)
  };
}

// ------------------------------------------------------------------ spin
function spin(token, betAmount, buyFeature = false) {
  const { session, merchant, player } = loadSession(token);
  const eff = merchants.effective(merchant, session.game_id, undefined, session);
  const game = withCap(eff.game, eff.max_win_x);
  if (exclusive.isExclusive(game)) throw bad('USE_ACTION_ENDPOINT', 'This SpinKit Exclusive game is played with POST /api/v1/rgs/action');

  return dbService.tx(() => {
    const user = players.byId(player.id);
    const gameState = dbService.getGameState(user.id, game.id);
    const hasFreeSpins = gameState.free_spins_left > 0;
    const bet = Number(betAmount);
    const isBuy = !!buyFeature && !hasFreeSpins;

    if (!hasFreeSpins && !eff.enabled) throw new ApiError(403, 'GAME_DISABLED', 'Game is disabled for this merchant');

    let cost = 0;
    if (!hasFreeSpins) {
      if (!bet || !eff.bet_steps.includes(bet)) throw bad('INVALID_BET', 'Ставка не соответствует сетке ставок.', { allowed_steps: eff.bet_steps });
      if (isBuy && !(game.free_spins && game.free_spins.buy)) throw bad('FEATURE_NOT_AVAILABLE', 'Покупка бонуса недоступна в этой игре.');
      cost = isBuy ? bet * game.free_spins.buy_cost : bet;
      if (user.balance < cost) throw bad('INSUFFICIENT_FUNDS', 'Недостаточно средств.', { balance: user.balance, required: cost });
    }

    // QA: force the feature on the next paid spin of a test session
    const forced = !hasFreeSpins && !isBuy && session.force_feature && !!game.free_spins;
    const res = RgsEngine.calculateSpin({
      game,
      betAmount: hasFreeSpins ? (gameState.free_spins_bet || bet) : bet,
      activeState: gameState,
      buyFeature: isBuy || forced
    });
    if (forced) db().prepare('UPDATE session_tokens SET force_feature = 0 WHERE token = ?').run(token);

    const jpWins = cost > 0 ? jackpots.contribute(merchant, cost, { userId: user.id, gameId: game.id, roundId: res.round_id }) : [];
    const jpTotal = jpWins.reduce((s, w) => s + w.amount, 0);

    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - cost + res.total_win + jpTotal;
    db().prepare('UPDATE users SET balance = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(balanceAfter, user.id);

    const fsLeft = res.free_spins.remaining;
    const fsTotal = hasFreeSpins ? (gameState.free_spins_total_win || 0) + res.total_win : (fsLeft > 0 ? res.total_win : 0);
    dbService.updateGameState(user.id, game.id, {
      free_spins_left: fsLeft,
      free_spins_multiplier: res.free_spins.multiplier,
      free_spins_bet: hasFreeSpins ? gameState.free_spins_bet : (fsLeft > 0 ? bet : 0),
      free_spins_total_win: fsTotal,
      active_bonus_data: fsLeft > 0 ? JSON.stringify(res.bonus || {}) : null
    });

    dbService.recordTransaction({
      round_id: res.round_id,
      user_id: user.id,
      game_id: game.id,
      bet_amount: cost,
      win_amount: res.total_win + jpTotal,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      matrix: res.final_matrix,
      winning_lines: res.winning_lines,
      is_free_spin: res.is_free_spin,
      merchant_id: merchant.id,
      rtp_profile: eff.rtp_profile,
      jackpot_win: jpTotal,
      bet_type: isBuy ? 'buy' : (res.is_free_spin ? 'free_spin' : 'spin'),
      session_token: token,
      test_mode: !!session.test_mode,
      details: {
        bet: res.bet,
        game_win: res.total_win,
        scatter_win: res.scatter_win,
        free_spins: res.free_spins,
        jackpot_wins: jpWins,
        multipliers: res.multipliers,
        giants: res.giants || undefined,
        forced_feature: forced || undefined
      }
    });
    db().prepare('UPDATE session_tokens SET spins = spins + 1 WHERE token = ?').run(token);

    return {
      round_id: res.round_id,
      mechanic: res.mechanic,
      bet: res.bet,
      cost,
      buy_feature: isBuy,
      matrix: res.matrix,
      final_matrix: res.final_matrix,
      stop_positions: res.stop_positions,
      winning_lines: res.winning_lines,
      scatter_win: res.scatter_win,
      cascades: res.cascades,
      multipliers: res.multipliers,
      wild_multipliers: res.wild_multipliers,
      giants: res.giants,
      spots: res.spots,
      heights: res.heights,
      ways: res.ways,
      reels: res.reels,
      final_reels: res.final_reels,
      win_multiplier: res.win_multiplier,
      coins: res.coins,
      holdwin: res.holdwin,
      total_win: res.total_win,
      jackpot_wins: jpWins,
      max_win_reached: res.max_win_reached,
      balance: balanceAfter,
      free_spins: {
        is_free_spin: res.free_spins.is_free_spin,
        remaining: fsLeft,
        awarded: res.free_spins.awarded,
        multiplier: res.free_spins.multiplier,
        total_multiplier: res.free_spins.total_multiplier,
        total_accumulated_win: fsTotal
      },
      jackpots: jackpots.ticker(merchant)
    };
  });
}

/** In-game "+" button (social / demo merchants only). */
function refill(token) {
  const { merchant, player } = loadSession(token);
  if (!merchant.demo_refill) throw new ApiError(403, 'REFILL_DISABLED', 'Free credits are not available for this merchant');
  const u = dbService.refillBalance(player.id, REFILL_AMOUNT);
  db().prepare("INSERT INTO wallet_ledger (merchant_id, user_id, type, amount, player_balance_after, actor) VALUES (?, ?, 'refill', ?, ?, 'player')")
    .run(merchant.id, u.id, REFILL_AMOUNT, u.balance);
  return { status: 'success', balance: u.balance, added: REFILL_AMOUNT };
}

/** SpinKit Exclusive round actions (start / shoot / cashout / seed / skin). */
function action(token, body) {
  return exclusive.action(token, body);
}

module.exports = { publicGameConfig, launch, init, spin, refill, loadSession, action };
