const { dbService } = require('../db/database');
const { GAMES_CATALOG, RTP_PROFILES, QA_RTP_RANGE, getGame, collectionOf } = require('../games/catalog');
const { sha256, randomToken, isValidIpRule } = require('./security');
const { bad, notFound, ApiError } = require('./errors');
const jackpots = require('./jackpots');

const db = () => dbService.db;

const PUBLIC_FIELDS = ['id', 'code', 'name', 'status', 'currency', 'float_balance', 'float_unlimited', 'ip_whitelist', 'require_signature',
  'rtp_profile', 'min_bet', 'max_bet', 'max_win_x', 'jackpot_enabled', 'demo_refill', 'lobby_url', 'notes', 'created_at'];

function present(m, { withSecret = false } = {}) {
  if (!m) return null;
  const out = {};
  for (const k of PUBLIC_FIELDS) out[k] = m[k];
  out.ip_whitelist = JSON.parse(m.ip_whitelist || '[]');
  out.float_unlimited = !!m.float_unlimited;
  out.require_signature = !!m.require_signature;
  out.jackpot_enabled = !!m.jackpot_enabled;
  out.demo_refill = !!m.demo_refill;
  out.has_signing_secret = !!m.signing_secret;
  if (withSecret) out.signing_secret = m.signing_secret;
  return out;
}

function get(id) {
  return db().prepare('SELECT * FROM merchants WHERE id = ?').get(id) || null;
}

function mustGet(id) {
  const m = get(id);
  if (!m) throw notFound('MERCHANT_NOT_FOUND', `Merchant ${id} not found`);
  return m;
}

function list() {
  return db().prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM users u WHERE u.merchant_id = m.id) AS players,
      (SELECT COUNT(*) FROM merchant_tokens t WHERE t.merchant_id = m.id AND t.revoked_at IS NULL) AS tokens
    FROM merchants m ORDER BY m.id
  `).all().map((m) => ({ ...present(m), players: m.players, tokens: m.tokens }));
}

function validateCurrency(c) {
  const code = String(c || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) throw bad('INVALID_CURRENCY', 'Currency must be a 2-8 letter code, e.g. EU, US, RU, USD, EUR, FUN, GC');
  return code;
}

function validateProfile(p) {
  const v = Number(p);
  if (!RTP_PROFILES.includes(v)) throw bad('INVALID_RTP_PROFILE', `RTP profile must be one of ${RTP_PROFILES.join(', ')}`);
  return v;
}

function validateLimit(v, name) {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad('INVALID_LIMIT', `${name} must be a positive integer in minor units or null`);
  return n;
}

function create(data, actor = 'system') {
  const code = String(data.code || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(code)) throw bad('INVALID_CODE', 'Merchant code: 2-32 chars, a-z 0-9 _ -');
  if (!data.name) throw bad('INVALID_NAME', 'Merchant name is required');
  if (db().prepare('SELECT 1 FROM merchants WHERE code = ?').get(code)) throw new ApiError(409, 'DUPLICATE_CODE', `Merchant code "${code}" already exists`);
  const currency = validateCurrency(data.currency || 'USD');
  const res = db().prepare(`
    INSERT INTO merchants (code, name, currency, float_balance, float_unlimited, rtp_profile, jackpot_enabled, signing_secret, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, String(data.name).slice(0, 120), currency, Number(data.float_balance) || 0, data.float_unlimited ? 1 : 0,
    data.rtp_profile ? validateProfile(data.rtp_profile) : 96, data.jackpot_enabled === false ? 0 : 1,
    randomToken('whsec_', 24), data.notes || null);
  const id = Number(res.lastInsertRowid);
  jackpots.ensureDefaults(id);
  dbService.audit(actor, 'merchant.create', `merchant:${id}`, { code, name: data.name, currency });
  return present(get(id));
}

const UPDATABLE = {
  name: (v) => String(v).slice(0, 120),
  status: (v) => { if (!['active', 'suspended'].includes(v)) throw bad('INVALID_STATUS', 'status: active | suspended'); return v; },
  currency: validateCurrency,
  float_unlimited: (v) => (v ? 1 : 0),
  require_signature: (v) => (v ? 1 : 0),
  rtp_profile: validateProfile,
  min_bet: (v) => validateLimit(v, 'min_bet'),
  max_bet: (v) => validateLimit(v, 'max_bet'),
  max_win_x: (v) => (v === null || v === '' ? null : Math.max(10, Math.floor(Number(v)))),
  jackpot_enabled: (v) => (v ? 1 : 0),
  demo_refill: (v) => (v ? 1 : 0),
  lobby_url: (v) => (v ? String(v).slice(0, 500) : null),
  notes: (v) => (v ? String(v).slice(0, 2000) : null),
  ip_whitelist: (v) => {
    const arr = (Array.isArray(v) ? v : String(v || '').split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean);
    const invalid = arr.filter((r) => !isValidIpRule(r));
    if (invalid.length) throw bad('INVALID_IP', `Invalid IP rules: ${invalid.join(', ')}`);
    return JSON.stringify([...new Set(arr)]);
  }
};

function update(id, patch, actor = 'system') {
  mustGet(id);
  const sets = [];
  const vals = [];
  const changed = {};
  for (const [k, fn] of Object.entries(UPDATABLE)) {
    if (patch[k] === undefined) continue;
    const v = fn(patch[k]);
    sets.push(`${k} = ?`);
    vals.push(v);
    changed[k] = patch[k];
  }
  const m = get(id);
  const minB = changed.min_bet !== undefined ? validateLimit(patch.min_bet) : m.min_bet;
  const maxB = changed.max_bet !== undefined ? validateLimit(patch.max_bet) : m.max_bet;
  if (minB && maxB && minB > maxB) throw bad('INVALID_LIMIT', 'min_bet must be <= max_bet');
  if (!sets.length) return present(m);
  db().prepare(`UPDATE merchants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  if (changed.jackpot_enabled) jackpots.ensureDefaults(id);
  dbService.audit(actor, 'merchant.update', `merchant:${id}`, changed);
  return present(get(id));
}

function rotateSecret(id, actor) {
  mustGet(id);
  const secret = randomToken('whsec_', 24);
  db().prepare('UPDATE merchants SET signing_secret = ? WHERE id = ?').run(secret, id);
  dbService.audit(actor, 'merchant.rotate_secret', `merchant:${id}`);
  return secret;
}

// ------------------------------------------------------------------ API tokens
function createToken(merchantId, name, actor) {
  mustGet(merchantId);
  const token = randomToken('sk_live_', 30);
  const prefix = token.slice(0, 14);
  const res = db().prepare('INSERT INTO merchant_tokens (merchant_id, name, prefix, token_hash) VALUES (?, ?, ?, ?)')
    .run(merchantId, String(name || 'API token').slice(0, 80), prefix, sha256(token));
  dbService.audit(actor, 'token.create', `merchant:${merchantId}`, { token_id: Number(res.lastInsertRowid), name, prefix });
  return { id: Number(res.lastInsertRowid), name, prefix, token };
}

function listTokens(merchantId) {
  return db().prepare('SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM merchant_tokens WHERE merchant_id = ? ORDER BY id DESC').all(merchantId);
}

function revokeToken(merchantId, tokenId, actor) {
  const r = db().prepare('UPDATE merchant_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ? AND revoked_at IS NULL').run(tokenId, merchantId);
  if (!r.changes) throw notFound('TOKEN_NOT_FOUND', 'Token not found or already revoked');
  dbService.audit(actor, 'token.revoke', `merchant:${merchantId}`, { token_id: tokenId });
}

/** Returns the merchant for a raw bearer token, or null. */
function authenticate(rawToken) {
  if (!rawToken) return null;
  const row = db().prepare('SELECT * FROM merchant_tokens WHERE token_hash = ? AND revoked_at IS NULL').get(sha256(rawToken));
  if (!row) return null;
  db().prepare('UPDATE merchant_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
  return get(row.merchant_id);
}

// ------------------------------------------------------------------ float
function adjustFloat(merchantId, amount, actor, note) {
  const m = mustGet(merchantId);
  const a = Math.trunc(Number(amount));
  if (!a) throw bad('INVALID_AMOUNT', 'amount must be a non-zero integer (minor units)');
  if (!m.float_unlimited && m.float_balance + a < 0) throw bad('INSUFFICIENT_FLOAT', 'Merchant float cannot go negative');
  db().prepare('UPDATE merchants SET float_balance = float_balance + ? WHERE id = ?').run(a, merchantId);
  const after = get(merchantId).float_balance;
  db().prepare('INSERT INTO wallet_ledger (merchant_id, type, amount, float_after, note, actor) VALUES (?, ?, ?, ?, ?, ?)')
    .run(merchantId, 'float_adjust', a, after, note || null, actor);
  dbService.audit(actor, 'merchant.float_adjust', `merchant:${merchantId}`, { amount: a, note });
  return after;
}

// ------------------------------------------------------------------ per-game settings
function gameSettingsMap(merchantId) {
  const rows = db().prepare('SELECT * FROM merchant_games WHERE merchant_id = ?').all(merchantId);
  return Object.fromEntries(rows.map((r) => [r.game_id, r]));
}

/** Is the game switched on for this merchant (no row = on)? */
function isGameEnabled(merchantId, gameId, map = null) {
  const s = map ? map[gameId] : db().prepare('SELECT enabled FROM merchant_games WHERE merchant_id = ? AND game_id = ?').get(merchantId, gameId);
  return !s || s.enabled === undefined || s.enabled === null || !!s.enabled;
}

function listGameSettings(merchantId) {
  const m = mustGet(merchantId);
  const map = gameSettingsMap(merchantId);
  return Object.values(GAMES_CATALOG).map((g) => {
    const s = map[g.id] || {};
    const eff = effective(m, g.id, s);
    return {
      game_id: g.id,
      name: g.name,
      mechanic: g.mechanic,
      category: g.category,
      collection: collectionOf(g),
      skin_of: g.skin_of || null,
      enabled: s.enabled === undefined ? true : !!s.enabled,
      rtp_profile: s.rtp_profile == null ? null : s.rtp_profile,
      min_bet: s.min_bet == null ? null : s.min_bet,
      max_bet: s.max_bet == null ? null : s.max_bet,
      effective: { rtp: eff.rtp, rtp_profile: eff.rtp_profile, min_bet: eff.min_bet, max_bet: eff.max_bet, default_bet: eff.default_bet }
    };
  });
}

/** Game ids matching a bulk filter { collection, mechanic, category, ids } (all games when empty). */
function filterGames(filter = {}) {
  return Object.values(GAMES_CATALOG).filter((g) =>
    (!filter.collection || collectionOf(g) === filter.collection) &&
    (!filter.mechanic || g.mechanic === filter.mechanic) &&
    (!filter.category || g.category === filter.category) &&
    (!Array.isArray(filter.ids) || filter.ids.includes(g.id))
  ).map((g) => g.id);
}

/**
 * Per-game settings. gameId '*' = bulk: every game, or only those matching patch.filter
 * ({ collection: 'artwork' | 'basic', mechanic, category, ids }).
 */
function setGameSetting(merchantId, gameId, patchIn, actor) {
  mustGet(merchantId);
  const { filter, ...patch } = patchIn || {};
  const ids = gameId === '*' ? filterGames(filter) : [gameId];
  for (const id of ids) if (!GAMES_CATALOG[id]) throw notFound('GAME_NOT_FOUND', `Game ${id} not found`);
  const cur = gameSettingsMap(merchantId);
  const stmt = db().prepare(`
    INSERT INTO merchant_games (merchant_id, game_id, enabled, rtp_profile, min_bet, max_bet) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(merchant_id, game_id) DO UPDATE SET enabled = excluded.enabled, rtp_profile = excluded.rtp_profile,
      min_bet = excluded.min_bet, max_bet = excluded.max_bet
  `);
  const pick = (id, k, fn) => (patch[k] === undefined ? (cur[id] ? cur[id][k] : null) : fn(patch[k]));
  dbService.tx(() => {
    for (const id of ids) {
      const enabled = patch.enabled === undefined ? (cur[id] ? cur[id].enabled : 1) : (patch.enabled ? 1 : 0);
      const prof = pick(id, 'rtp_profile', (v) => (v === null || v === '' ? null : validateProfile(v)));
      const minB = pick(id, 'min_bet', (v) => validateLimit(v, 'min_bet'));
      const maxB = pick(id, 'max_bet', (v) => validateLimit(v, 'max_bet'));
      if (minB && maxB && minB > maxB) throw bad('INVALID_LIMIT', 'min_bet must be <= max_bet');
      stmt.run(merchantId, id, enabled, prof, minB, maxB);
    }
  });
  dbService.audit(actor, 'merchant.game_settings', `merchant:${merchantId}`, { game: gameId, ...(filter ? { filter } : {}), ...patch });
  return gameId === '*' ? { updated: ids.length } : listGameSettings(merchantId).find((g) => g.game_id === gameId);
}

/**
 * Effective configuration of a game for a merchant (and optionally a session):
 * RTP profile (session QA override > game override > merchant default) and bet limits.
 */
function effective(merchant, gameId, setting = undefined, session = null) {
  const m = typeof merchant === 'object' ? merchant : mustGet(merchant);
  const s = setting === undefined ? (db().prepare('SELECT * FROM merchant_games WHERE merchant_id = ? AND game_id = ?').get(m.id, gameId) || {}) : setting;
  const enabled = s.enabled === undefined ? true : !!s.enabled;
  const qa = !!(session && session.test_mode && session.rtp_profile != null);
  const profile = qa ? Number(session.rtp_profile) : (s.rtp_profile != null ? s.rtp_profile : m.rtp_profile || 96);
  const game = getGame(gameId, profile, { qa });
  if (!game) throw notFound('GAME_NOT_FOUND', `Game ${gameId} not found`);

  const lo = Math.max(m.min_bet || 0, s.min_bet || 0);
  const hiCands = [m.max_bet, s.max_bet].filter((x) => x);
  const hi = hiCands.length ? Math.min(...hiCands) : Infinity;
  let steps = game.bet_steps.filter((b) => b >= lo && b <= hi);
  if (!steps.length) {
    // limits fall between two steps: take the closest step to the allowed range
    const target = lo || hi;
    steps = [game.bet_steps.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))];
  }
  const def = steps.includes(game.default_bet) ? game.default_bet : steps.reduce((a, b) => (Math.abs(b - game.default_bet) < Math.abs(a - game.default_bet) ? b : a));
  return {
    game,
    enabled,
    rtp: game.rtp,
    rtp_profile: game.rtp_profile || 96,
    qa,
    bet_steps: steps,
    min_bet: steps[0],
    max_bet: steps[steps.length - 1],
    default_bet: def,
    max_win_x: m.max_win_x ? Math.min(m.max_win_x, game.max_win_x) : game.max_win_x
  };
}

module.exports = {
  present, get, mustGet, list, create, update, rotateSecret,
  createToken, listTokens, revokeToken, authenticate, adjustFloat,
  listGameSettings, setGameSetting, effective, gameSettingsMap, isGameEnabled, RTP_PROFILES, QA_RTP_RANGE,
  validateCurrency
};
