const { dbService } = require('../db/database');
const { GAMES_CATALOG } = require('../games/catalog');

const db = () => dbService.db;

function periodWhere({ merchantId, from, to, days, includeTest, gameId, userId }, alias = 't') {
  const w = [];
  const a = [];
  if (merchantId) { w.push(`${alias}.merchant_id = ?`); a.push(Number(merchantId)); }
  if (gameId) { w.push(`${alias}.game_id = ?`); a.push(gameId); }
  if (userId) { w.push(`${alias}.user_id = ?`); a.push(Number(userId)); }
  if (from) { w.push(`${alias}.created_at >= ?`); a.push(toSql(from)); }
  if (to) { w.push(`${alias}.created_at < ?`); a.push(toSql(to, true)); }
  if (!from && !to && days) { w.push(`${alias}.created_at >= datetime('now', ?)`); a.push(`-${Number(days)} days`); }
  if (!includeTest) w.push(`${alias}.test_mode = 0`);
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', args: a };
}

function toSql(d, endOfDay = false) {
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return endOfDay ? `${s} 23:59:59.999` : `${s} 00:00:00`;
  return new Date(s).toISOString().replace('T', ' ').slice(0, 19);
}

function totals(filter) {
  const { sql, args } = periodWhere(filter);
  const r = db().prepare(`
    SELECT COUNT(*) AS rounds, COALESCE(SUM(bet_amount),0) AS bets, COALESCE(SUM(win_amount),0) AS wins,
      COALESCE(SUM(jackpot_win),0) AS jackpot_wins, COUNT(DISTINCT user_id) AS players,
      SUM(CASE WHEN bet_type = 'buy' THEN 1 ELSE 0 END) AS feature_buys,
      SUM(CASE WHEN bet_type = 'free_spin' THEN 1 ELSE 0 END) AS free_spins
    FROM rgs_transactions t ${sql}
  `).get(...args);
  return { ...r, ggr: r.bets - r.wins, rtp_actual: r.bets ? r.wins / r.bets : null };
}

function daily(filter) {
  const { sql, args } = periodWhere(filter);
  return db().prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS rounds, SUM(bet_amount) AS bets, SUM(win_amount) AS wins,
      SUM(bet_amount) - SUM(win_amount) AS ggr, COUNT(DISTINCT user_id) AS players
    FROM rgs_transactions t ${sql} GROUP BY day ORDER BY day
  `).all(...args);
}

function byMerchant(filter) {
  const { sql, args } = periodWhere({ ...filter, merchantId: null });
  return db().prepare(`
    SELECT m.id, m.code, m.name, m.currency, m.status, m.float_balance, m.float_unlimited,
      COALESCE(x.rounds,0) AS rounds, COALESCE(x.bets,0) AS bets, COALESCE(x.wins,0) AS wins,
      COALESCE(x.bets,0) - COALESCE(x.wins,0) AS ggr, COALESCE(x.players,0) AS players
    FROM merchants m LEFT JOIN (
      SELECT merchant_id, COUNT(*) AS rounds, SUM(bet_amount) AS bets, SUM(win_amount) AS wins, COUNT(DISTINCT user_id) AS players
      FROM rgs_transactions t ${sql} GROUP BY merchant_id
    ) x ON x.merchant_id = m.id ORDER BY ggr DESC, m.id
  `).all(...args);
}

function byGame(filter, limit = 20) {
  const { sql, args } = periodWhere(filter);
  return db().prepare(`
    SELECT game_id, COUNT(*) AS rounds, SUM(bet_amount) AS bets, SUM(win_amount) AS wins, SUM(bet_amount) - SUM(win_amount) AS ggr,
      COUNT(DISTINCT user_id) AS players
    FROM rgs_transactions t ${sql} GROUP BY game_id ORDER BY bets DESC LIMIT ?
  `).all(...args, limit).map((r) => ({ ...r, name: GAMES_CATALOG[r.game_id] ? GAMES_CATALOG[r.game_id].name : r.game_id, rtp_actual: r.bets ? r.wins / r.bets : null }));
}

function live(merchantId) {
  const w = merchantId ? 'AND merchant_id = ?' : '';
  const a = merchantId ? [merchantId] : [];
  return {
    active_sessions: db().prepare(`SELECT COUNT(*) AS n FROM session_tokens WHERE expires_at > ? AND revoked = 0 ${w}`).get(Date.now(), ...a).n,
    players_online: db().prepare(`SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= datetime('now', '-5 minutes') ${w}`).get(...a).n,
    rounds_last_hour: db().prepare(`SELECT COUNT(*) AS n FROM rgs_transactions WHERE created_at >= datetime('now', '-1 hour') ${w}`).get(...a).n
  };
}

function dashboard(filter) {
  return {
    period: { days: filter.days || null, from: filter.from || null, to: filter.to || null },
    totals: totals(filter),
    daily: daily(filter),
    merchants: filter.merchantId ? undefined : byMerchant(filter),
    top_games: byGame(filter, 10),
    live: live(filter.merchantId)
  };
}

function rounds(filter, limit = 50, offset = 0) {
  const { sql, args } = periodWhere(filter);
  const rows = db().prepare(`
    SELECT t.*, u.external_id, u.username, m.code AS merchant_code, m.currency
    FROM rgs_transactions t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN merchants m ON m.id = t.merchant_id
    ${sql} ORDER BY t.id DESC LIMIT ? OFFSET ?
  `).all(...args, Math.min(500, Number(limit) || 50), Number(offset) || 0);
  const total = db().prepare(`SELECT COUNT(*) AS n FROM rgs_transactions t ${sql}`).get(...args).n;
  return { total, rounds: rows.map(presentRound) };
}

function presentRound(r) {
  const t = dbService.mapTx(r);
  return {
    round_id: t.round_id,
    created_at: t.created_at,
    merchant_id: t.merchant_id,
    merchant_code: r.merchant_code,
    player_id: t.user_id,
    external_id: r.external_id,
    game_id: t.game_id,
    game_name: GAMES_CATALOG[t.game_id] ? GAMES_CATALOG[t.game_id].name : t.game_id,
    type: t.bet_type,
    bet: t.bet_amount,
    win: t.win_amount,
    jackpot_win: t.jackpot_win,
    balance_before: t.balance_before,
    balance_after: t.balance_after,
    currency: r.currency,
    rtp_profile: t.rtp_profile,
    test_mode: t.test_mode,
    is_free_spin: t.is_free_spin,
    matrix: t.matrix,
    wins: t.winning_lines,
    details: t.details
  };
}

function round(roundId, merchantId = null) {
  const r = db().prepare(`
    SELECT t.*, u.external_id, u.username, m.code AS merchant_code, m.currency
    FROM rgs_transactions t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN merchants m ON m.id = t.merchant_id
    WHERE t.round_id = ? ${merchantId ? 'AND t.merchant_id = ?' : ''}
  `).get(...(merchantId ? [roundId, merchantId] : [roundId]));
  return r ? presentRound(r) : null;
}

function sessions({ merchantId = null, activeOnly = true, limit = 100 } = {}) {
  const w = [];
  const a = [];
  if (merchantId) { w.push('s.merchant_id = ?'); a.push(merchantId); }
  if (activeOnly) { w.push('s.expires_at > ? AND s.revoked = 0'); a.push(Date.now()); }
  return db().prepare(`
    SELECT s.token, s.user_id, s.game_id, s.expires_at, s.created_at, s.rtp_profile, s.test_mode, s.force_feature, s.spins, s.revoked, s.client_ip,
      u.external_id, u.username, u.is_test, m.code AS merchant_code
    FROM session_tokens s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN merchants m ON m.id = s.merchant_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.created_at DESC LIMIT ?
  `).all(...a, limit).map((s) => ({
    ...s,
    token: s.token.slice(0, 8) + '…',
    token_full: s.token,
    game_name: GAMES_CATALOG[s.game_id] ? GAMES_CATALOG[s.game_id].name : s.game_id,
    expires_at: new Date(s.expires_at).toISOString(),
    test_mode: !!s.test_mode,
    force_feature: !!s.force_feature
  }));
}

function audit(limit = 100) {
  return db().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit).map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}

module.exports = { dashboard, totals, daily, byMerchant, byGame, rounds, round, sessions, audit, live };
