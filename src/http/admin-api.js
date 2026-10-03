const { GAMES_CATALOG, RTP_PROFILES, QA_RTP_RANGE, COLLECTIONS, collectionOf } = require('../games/catalog');
const merchants = require('../services/merchants');
const players = require('../services/players');
const jackpots = require('../services/jackpots');
const reports = require('../services/reports');
const admin = require('../services/admin');
const gameService = require('../services/game-service');
const { currencyInfo } = require('../services/currency');
const { adminAuth, setAdminCookie, clearAdminCookie, readCookie, COOKIE } = require('./auth');
const { bad, notFound } = require('../services/errors');
const { dbService } = require('../db/database');

const num = (v) => (v === undefined || v === '' || v === null ? null : Number(v));

function register(router) {
  const auth = adminAuth;

  // ---------------------------------------------------------------- session
  router.post('/api/admin/login', (ctx) => {
    const r = admin.login(ctx.body.username, ctx.body.password, ctx.ip);
    setAdminCookie(ctx.res, r.token, r.max_age);
    return { status: 'success', admin: r.admin };
  });
  router.post('/api/admin/logout', (ctx) => {
    admin.logout(readCookie(ctx.req, COOKIE));
    clearAdminCookie(ctx.res);
    return { status: 'success' };
  });
  router.get('/api/admin/me', auth, (ctx) => ({ status: 'success', admin: ctx.admin }));
  router.post('/api/admin/password', auth, (ctx) => {
    admin.changePassword(ctx.admin.id, ctx.body.current_password, ctx.body.new_password);
    clearAdminCookie(ctx.res);
    return { status: 'success' };
  });
  router.get('/api/admin/admins', auth, () => ({ status: 'success', admins: admin.listAdmins() }));
  router.post('/api/admin/admins', auth, (ctx) => {
    if (ctx.admin.role !== 'owner') throw bad('FORBIDDEN', 'Only owners can create admin users');
    admin.createAdmin(ctx.body.username, ctx.body.password, ctx.body.role || 'admin', ctx.actor);
    return { status: 'success', admins: admin.listAdmins() };
  });

  // ---------------------------------------------------------------- dashboard
  router.get('/api/admin/dashboard', auth, (ctx) => {
    const q = ctx.query;
    const f = { merchantId: num(q.merchant_id), days: Number(q.days) || 14, includeTest: q.include_test === '1' };
    return { status: 'success', ...reports.dashboard(f), jackpot_wins: jackpots.recentWins(f.merchantId, 10) };
  });

  router.get('/api/admin/meta', auth, () => ({
    status: 'success',
    rtp_profiles: RTP_PROFILES,
    langs: merchants.LANGS,
    qa_rtp_range: QA_RTP_RANGE,
    games: Object.values(GAMES_CATALOG).map((g) => ({ id: g.id, name: g.name, mechanic: g.mechanic, category: g.category, collection: collectionOf(g), rtp: g.rtp, template: g.skin_of || g.id })),
    collections: Object.values(COLLECTIONS),
    merchants: merchants.list().map((m) => ({ id: m.id, code: m.code, name: m.name, currency: m.currency, currency_info: currencyInfo(m.currency) }))
  }));

  // ---------------------------------------------------------------- merchants
  router.get('/api/admin/merchants', auth, () => ({ status: 'success', merchants: merchants.list() }));
  router.post('/api/admin/merchants', auth, (ctx) => {
    const m = merchants.create(ctx.body, ctx.actor);
    const token = merchants.createToken(m.id, 'Default token', ctx.actor);
    return { status: 'success', merchant: m, token };
  });
  router.get('/api/admin/merchants/:id', auth, (ctx) => {
    const id = Number(ctx.params.id);
    const m = merchants.mustGet(id);
    return {
      status: 'success',
      merchant: { ...merchants.present(m, { withSecret: true }), currency_info: currencyInfo(m.currency) },
      tokens: merchants.listTokens(id),
      jackpots: jackpots.list(id),
      stats: reports.totals({ merchantId: id, days: 30 })
    };
  });
  router.patch('/api/admin/merchants/:id', auth, (ctx) => ({ status: 'success', merchant: merchants.update(Number(ctx.params.id), ctx.body, ctx.actor) }));
  router.post('/api/admin/merchants/:id/tokens', auth, (ctx) => ({ status: 'success', token: merchants.createToken(Number(ctx.params.id), ctx.body.name, ctx.actor) }));
  router.delete('/api/admin/merchants/:id/tokens/:token_id', auth, (ctx) => {
    merchants.revokeToken(Number(ctx.params.id), Number(ctx.params.token_id), ctx.actor);
    return { status: 'success' };
  });
  router.post('/api/admin/merchants/:id/secret', auth, (ctx) => ({ status: 'success', signing_secret: merchants.rotateSecret(Number(ctx.params.id), ctx.actor) }));
  router.post('/api/admin/merchants/:id/float', auth, (ctx) => ({ status: 'success', float_balance: merchants.adjustFloat(Number(ctx.params.id), ctx.body.amount, ctx.actor, ctx.body.note) }));

  router.get('/api/admin/merchants/:id/games', auth, (ctx) => ({ status: 'success', games: merchants.listGameSettings(Number(ctx.params.id)) }));
  router.patch('/api/admin/merchants/:id/games/:game_id', auth, (ctx) => ({ status: 'success', game: merchants.setGameSetting(Number(ctx.params.id), ctx.params.game_id, ctx.body, ctx.actor) }));

  router.get('/api/admin/merchants/:id/jackpots', auth, (ctx) => ({ status: 'success', jackpots: jackpots.list(Number(ctx.params.id)) }));
  router.patch('/api/admin/merchants/:id/jackpots/:tier', auth, (ctx) => ({ status: 'success', jackpot: jackpots.update(Number(ctx.params.id), ctx.params.tier, ctx.body, ctx.actor) }));
  router.post('/api/admin/merchants/:id/jackpots/:tier/reset', auth, (ctx) => {
    jackpots.reset(Number(ctx.params.id), ctx.params.tier, ctx.actor);
    return { status: 'success', jackpots: jackpots.list(Number(ctx.params.id)) };
  });
  router.get('/api/admin/jackpots/wins', auth, (ctx) => ({ status: 'success', wins: jackpots.recentWins(num(ctx.query.merchant_id), 100) }));

  // ---------------------------------------------------------------- players
  router.get('/api/admin/players', auth, (ctx) => {
    const q = ctx.query;
    return { status: 'success', ...players.list({ merchantId: num(q.merchant_id), q: q.q || '', limit: Number(q.limit) || 50, offset: Number(q.offset) || 0, testOnly: q.test === '1' }) };
  });
  router.post('/api/admin/players', auth, (ctx) => {
    const m = merchants.mustGet(Number(ctx.body.merchant_id));
    const { player, created } = players.getOrCreate(m, ctx.body.external_id, { username: ctx.body.username, is_test: ctx.body.is_test });
    dbService.audit(ctx.actor, 'player.create', `player:${player.id}`, { merchant: m.code, is_test: !!ctx.body.is_test });
    return { status: 'success', created, player: players.present(player) };
  });
  router.get('/api/admin/players/:id', auth, (ctx) => {
    const u = players.byId(Number(ctx.params.id));
    if (!u) throw notFound('PLAYER_NOT_FOUND', 'Player not found');
    const m = merchants.get(u.merchant_id);
    return {
      status: 'success',
      player: { ...players.present(u), merchant_code: m && m.code, currency_info: currencyInfo(m && m.currency) },
      stats: reports.totals({ userId: u.id, includeTest: true }),
      ledger: players.ledger({ userId: u.id, limit: 30 }),
      rounds: reports.rounds({ userId: u.id, includeTest: true }, 30).rounds,
      sessions: reports.sessions({ activeOnly: false, limit: 20 }).filter((s) => s.user_id === u.id)
    };
  });
  router.patch('/api/admin/players/:id', auth, (ctx) => ({ status: 'success', player: players.setFlags(Number(ctx.params.id), ctx.body, ctx.actor) }));
  router.post('/api/admin/players/:id/adjust', auth, (ctx) => ({ status: 'success', player: players.adminAdjust(Number(ctx.params.id), ctx.body.amount, ctx.body.note, ctx.actor) }));

  // ---------------------------------------------------------------- sessions / RTP manager
  router.get('/api/admin/sessions', auth, (ctx) => ({ status: 'success', sessions: reports.sessions({ merchantId: num(ctx.query.merchant_id), activeOnly: ctx.query.all !== '1' }) }));
  router.post('/api/admin/sessions', auth, (ctx) => {
    const u = players.byId(Number(ctx.body.player_id));
    if (!u) throw notFound('PLAYER_NOT_FOUND', 'Player not found');
    const m = merchants.mustGet(u.merchant_id);
    const r = gameService.launch({
      merchant: m, player: u, gameId: ctx.body.game_id, baseUrl: ctx.baseUrl, ttlMinutes: ctx.body.ttl_minutes || 120,
      test: { rtp_profile: ctx.body.rtp_profile, force_feature: ctx.body.force_feature }, clientIp: ctx.ip, lang: ctx.body.lang, actor: ctx.actor
    });
    return { status: 'success', session: r };
  });
  router.delete('/api/admin/sessions/:token', auth, (ctx) => {
    const r = dbService.db.prepare('UPDATE session_tokens SET revoked = 1 WHERE token = ?').run(ctx.params.token);
    if (!r.changes) throw notFound('SESSION_NOT_FOUND', 'Session not found');
    dbService.audit(ctx.actor, 'session.revoke', ctx.params.token.slice(0, 8));
    return { status: 'success' };
  });

  // ---------------------------------------------------------------- rounds, ledger, audit
  router.get('/api/admin/rounds', auth, (ctx) => {
    const q = ctx.query;
    return { status: 'success', ...reports.rounds({ merchantId: num(q.merchant_id), userId: num(q.player_id), gameId: q.game_id, from: q.from, to: q.to, includeTest: q.include_test !== '0' }, q.limit, q.offset) };
  });
  router.get('/api/admin/rounds/:round_id', auth, (ctx) => {
    const r = reports.round(ctx.params.round_id);
    if (!r) throw notFound('ROUND_NOT_FOUND', 'Round not found');
    return { status: 'success', round: r };
  });
  router.get('/api/admin/ledger', auth, (ctx) => ({ status: 'success', ledger: players.ledger({ merchantId: num(ctx.query.merchant_id), userId: num(ctx.query.player_id), limit: Number(ctx.query.limit) || 100 }) }));
  router.get('/api/admin/audit', auth, (ctx) => ({ status: 'success', audit: reports.audit(Math.min(500, Number(ctx.query.limit) || 100)) }));
}

module.exports = { register };
