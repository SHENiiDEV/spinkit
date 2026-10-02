const { GAMES_CATALOG, toIconFile, collectionOf } = require('../games/catalog');
const merchants = require('../services/merchants');
const players = require('../services/players');
const jackpots = require('../services/jackpots');
const reports = require('../services/reports');
const gameService = require('../services/game-service');
const mechanics = require('../engine/mechanics');
const { currencyInfo } = require('../services/currency');
const { merchantAuth } = require('./auth');
const { bad, notFound } = require('../services/errors');
const { dbService } = require('../db/database');

function gameSummary(g, eff, baseUrl) {
  return {
    game_id: g.id,
    name: g.name,
    category: g.category,
    collection: collectionOf(g),
    mechanic: g.mechanic,
    grid: `${g.reels_count}x${g.rows_count}`,
    paylines: g.paylines_count,
    ways: g.ways_count,
    volatility: g.volatility,
    rtp: eff.rtp,
    rtp_profile: eff.rtp_profile,
    max_win_x: eff.max_win_x,
    features: {
      free_spins: !!g.free_spins,
      feature_buy: !!(g.free_spins && g.free_spins.buy),
      feature_buy_cost_x: g.free_spins && g.free_spins.buy ? g.free_spins.buy_cost : null,
      multipliers: !!g.multipliers || !!(g.free_spins && (g.free_spins.wild_multipliers || g.free_spins.sticky_multipliers)),
      ...mechanics.features(g),
      sticky_giants: !!(g.free_spins && g.free_spins.sticky_giants)
    },
    bets: { min: eff.min_bet, max: eff.max_bet, default: eff.default_bet, steps: eff.bet_steps, ladder_max: g.max_bet_limit || g.max_bet },
    options: eff.options,
    template: g.skin_of || g.id,
    thumbnail_url: g.theme.thumb ? `${baseUrl}${g.theme.thumb}` : null,
    cover_image: g.theme.stage ? `${baseUrl}${g.theme.stage.image}` : null,
    thumbnail_icons: [toIconFile(g.theme.icon), ...Object.values(g.symbols).filter((s) => s.icon_file && !s.isScatter).map((s) => s.icon_file)]
      .filter(Boolean).slice(0, 3).map((f) => `${baseUrl}/games/assets/icons/${f}`),
    theme: { accent: g.theme.accent, background: [g.theme.bg1, g.theme.bg2], title: g.theme.title }
  };
}

function register(router) {
  const auth = merchantAuth;

  router.get('/api/v2/health', () => ({ status: 'ok', time: new Date().toISOString(), games: Object.keys(GAMES_CATALOG).length }));

  router.get('/api/v2/merchant', auth, (ctx) => {
    const m = merchants.present(ctx.merchant);
    return { status: 'success', merchant: { ...m, currency_info: currencyInfo(m.currency) }, your_ip: ctx.ip };
  });

  // ---------------------------------------------------------------- games
  router.get('/api/v2/games', auth, (ctx) => {
    const m = ctx.merchant;
    const settings = Object.fromEntries(dbService.db.prepare('SELECT * FROM merchant_games WHERE merchant_id = ?').all(m.id).map((r) => [r.game_id, r]));
    const { mechanic, category, collection } = ctx.query;
    const games = [];
    for (const g of Object.values(GAMES_CATALOG)) {
      if (mechanic && g.mechanic !== mechanic) continue;
      if (category && g.category !== category) continue;
      if (collection && collectionOf(g) !== collection) continue;
      const eff = merchants.effective(m, g.id, settings[g.id] || {});
      if (!eff.enabled) continue;
      games.push(gameSummary(g, eff, ctx.baseUrl));
    }
    return { status: 'success', currency: currencyInfo(m.currency), count: games.length, games };
  });

  router.get('/api/v2/games/:game_id', auth, (ctx) => {
    const g = GAMES_CATALOG[ctx.params.game_id];
    if (!g) throw notFound('GAME_NOT_FOUND', 'Game not found');
    const eff = merchants.effective(ctx.merchant, g.id);
    if (!eff.enabled) throw notFound('GAME_NOT_FOUND', 'Game is not enabled for this merchant');
    const cfg = gameService.publicGameConfig(eff.game, eff, ctx.merchant);
    return {
      status: 'success',
      game: {
        ...gameSummary(g, eff, ctx.baseUrl),
        paytable: cfg.paytable,
        paytable_unit: mechanics.getMechanic(g.mechanic).paytableUnit,
        symbols: Object.values(cfg.symbols).map((s) => ({ id: s.id, name: s.name, kind: s.kind, wild: !!s.isWild, scatter: !!s.isScatter })),
        free_spins: cfg.free_spins,
        multipliers: cfg.multipliers,
        paylines: cfg.paylines
      }
    };
  });

  // ---------------------------------------------------------------- operator settings (self-service)
  // Bet limits and game options the operator changes itself. RTP profiles stay with the provider (admin).
  const OPERATOR_KEYS = ['enabled', 'min_bet', 'max_bet', 'options'];
  const settingsOf = (m, id) => {
    const r = merchants.listGameSettings(m.id).find((x) => x.game_id === id);
    if (!r) throw notFound('GAME_NOT_FOUND', 'Game not found');
    const { rtp_profile, ...rest } = r;
    return rest;
  };
  router.get('/api/v2/games/:game_id/settings', auth, (ctx) => ({ status: 'success', settings: settingsOf(ctx.merchant, ctx.params.game_id) }));
  router.patch('/api/v2/games/:game_id/settings', auth, (ctx) => {
    if (!GAMES_CATALOG[ctx.params.game_id]) throw notFound('GAME_NOT_FOUND', 'Game not found');
    const patch = Object.fromEntries(Object.entries(ctx.body || {}).filter(([k]) => OPERATOR_KEYS.includes(k)));
    const unknown = Object.keys(ctx.body || {}).filter((k) => !OPERATOR_KEYS.includes(k));
    if (unknown.length) throw bad('INVALID_REQUEST', `Not an operator setting: ${unknown.join(', ')} (allowed: ${OPERATOR_KEYS.join(', ')})`);
    merchants.setGameSetting(ctx.merchant.id, ctx.params.game_id, patch, `merchant:${ctx.merchant.code}`);
    return { status: 'success', settings: settingsOf(ctx.merchant, ctx.params.game_id) };
  });
  router.patch('/api/v2/merchant', auth, (ctx) => {
    const allowed = ['default_lang', 'lobby_url'];
    const extra = Object.keys(ctx.body || {}).filter((k) => !allowed.includes(k));
    if (extra.length) throw bad('INVALID_REQUEST', `Only ${allowed.join(', ')} can be changed here`);
    const m = merchants.update(ctx.merchant.id, ctx.body, `merchant:${ctx.merchant.code}`);
    return { status: 'success', merchant: m };
  });

  // ---------------------------------------------------------------- players & wallet
  router.post('/api/v2/players', auth, (ctx) => {
    const { external_id, username, is_test } = ctx.body;
    const { player, created } = players.getOrCreate(ctx.merchant, external_id, { username, is_test });
    return { status: 'success', created, player: players.present(player) };
  });

  router.get('/api/v2/players/:external_id', auth, (ctx) => ({ status: 'success', player: players.present(players.mustByExternal(ctx.merchant.id, ctx.params.external_id)) }));

  const transfer = (type) => (ctx) => {
    const { amount, tx_id } = ctx.body;
    const r = players[type](ctx.merchant, ctx.params.external_id, amount, tx_id);
    return {
      status: 'success',
      idempotent: r.idempotent,
      transaction: { id: r.tx.id, type, amount: Math.abs(r.tx.amount), tx_id: r.tx.ext_tx_id, created_at: r.tx.created_at },
      balance: r.player.balance
    };
  };
  router.post('/api/v2/players/:external_id/deposit', auth, transfer('deposit'));
  router.post('/api/v2/players/:external_id/withdraw', auth, transfer('withdraw'));

  router.get('/api/v2/players/:external_id/transactions', auth, (ctx) => {
    const p = players.mustByExternal(ctx.merchant.id, ctx.params.external_id);
    return { status: 'success', transactions: players.ledger({ merchantId: ctx.merchant.id, userId: p.id, limit: Number(ctx.query.limit) || 50 }) };
  });

  // ---------------------------------------------------------------- sessions
  router.post('/api/v2/sessions', auth, (ctx) => {
    const { external_id, game_id, username, lobby_url, ttl_minutes, test, lang } = ctx.body;
    if (!game_id) throw bad('INVALID_REQUEST', 'game_id is required');
    const { player } = players.getOrCreate(ctx.merchant, external_id, { username });
    const r = gameService.launch({ merchant: ctx.merchant, player, gameId: game_id, baseUrl: ctx.baseUrl, ttlMinutes: ttl_minutes, test, lobbyUrl: lobby_url, clientIp: ctx.ip, lang, actor: `merchant:${ctx.merchant.code}` });
    return { status: 'success', session: { ...r, player: players.present(players.byId(player.id)) } };
  });

  router.delete('/api/v2/sessions/:token', auth, (ctx) => {
    const r = dbService.db.prepare('UPDATE session_tokens SET revoked = 1 WHERE token = ? AND merchant_id = ?').run(ctx.params.token, ctx.merchant.id);
    if (!r.changes) throw notFound('SESSION_NOT_FOUND', 'Session not found');
    return { status: 'success', revoked: true };
  });

  // ---------------------------------------------------------------- rounds & reports
  router.get('/api/v2/rounds', auth, (ctx) => {
    const q = ctx.query;
    let userId = null;
    if (q.external_id) userId = players.mustByExternal(ctx.merchant.id, q.external_id).id;
    const r = reports.rounds({ merchantId: ctx.merchant.id, userId, gameId: q.game_id, from: q.from, to: q.to, includeTest: q.include_test === '1' }, q.limit, q.offset);
    return { status: 'success', ...r };
  });

  router.get('/api/v2/rounds/:round_id', auth, (ctx) => {
    const r = reports.round(ctx.params.round_id, ctx.merchant.id);
    if (!r) throw notFound('ROUND_NOT_FOUND', 'Round not found');
    return { status: 'success', round: r };
  });

  router.get('/api/v2/jackpots', auth, (ctx) => ({
    status: 'success',
    enabled: !!ctx.merchant.jackpot_enabled,
    currency: currencyInfo(ctx.merchant.currency),
    jackpots: jackpots.list(ctx.merchant.id).map(({ tier, name, amount, must_hit_by, min_bet, enabled, hits, last_hit_at, last_hit_amount }) => ({ tier, name, amount, must_hit_by, min_bet, enabled, hits, last_hit_at, last_hit_amount }))
  }));

  router.get('/api/v2/jackpots/wins', auth, (ctx) => ({
    status: 'success',
    wins: jackpots.recentWins(ctx.merchant.id, Math.min(200, Number(ctx.query.limit) || 50)).map((w) => ({ tier: w.tier, amount: w.amount, external_id: w.external_id, game_id: w.game_id, round_id: w.round_id, created_at: w.created_at }))
  }));

  router.get('/api/v2/reports/summary', auth, (ctx) => {
    const q = ctx.query;
    const f = { merchantId: ctx.merchant.id, from: q.from, to: q.to, days: q.from || q.to ? null : Number(q.days) || 30 };
    return { status: 'success', currency: currencyInfo(ctx.merchant.currency), summary: reports.totals(f), by_game: reports.byGame(f, 100) };
  });

  router.get('/api/v2/reports/daily', auth, (ctx) => {
    const q = ctx.query;
    const f = { merchantId: ctx.merchant.id, from: q.from, to: q.to, days: q.from || q.to ? null : Number(q.days) || 30 };
    return { status: 'success', currency: currencyInfo(ctx.merchant.currency), days: reports.daily(f) };
  });
}

module.exports = { register };
