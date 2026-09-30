const { dbService } = require('../db/database');
const { STARTING_BALANCE } = require('../config');
const { bad, notFound, ApiError } = require('./errors');

/**
 * Players live in the `users` table, scoped by merchant (merchant_id + external_id).
 * Transfer-wallet model: the merchant moves money in/out of a player's game balance
 * with deposit / withdraw. Deposits are drawn from the merchant float (unless the
 * merchant has an unlimited float), withdrawals go back to it. Both are idempotent
 * on the merchant's own transaction id (tx_id).
 */

const db = () => dbService.db;

function present(u) {
  if (!u) return null;
  return {
    player_id: u.id,
    external_id: u.external_id,
    username: u.username,
    merchant_id: u.merchant_id,
    balance: u.balance,
    currency: u.currency,
    is_test: !!u.is_test,
    status: u.status,
    created_at: u.created_at,
    last_seen_at: u.last_seen_at
  };
}

function validExternal(ext) {
  const e = String(ext == null ? '' : ext).trim();
  if (!/^[\w.@:-]{1,64}$/.test(e)) throw bad('INVALID_PLAYER_ID', 'external_id: 1-64 chars [A-Za-z0-9_.@:-]');
  return e;
}

function byExternal(merchantId, externalId) {
  return db().prepare('SELECT * FROM users WHERE merchant_id = ? AND external_id = ?').get(merchantId, String(externalId)) || null;
}

function mustByExternal(merchantId, externalId) {
  const u = byExternal(merchantId, externalId);
  if (!u) throw notFound('PLAYER_NOT_FOUND', `Player ${externalId} not found`);
  return u;
}

function byId(id) {
  return db().prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function getOrCreate(merchant, externalId, opts = {}) {
  const ext = validExternal(externalId);
  let u = byExternal(merchant.id, ext);
  let created = false;
  if (!u) {
    const id = dbService.nextUserId();
    const startBalance = merchant.demo_refill ? STARTING_BALANCE : 0;
    db().prepare('INSERT INTO users (id, username, balance, merchant_id, external_id, currency, is_test) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, String(opts.username || `Player_${ext}`).slice(0, 64), startBalance, merchant.id, ext, merchant.currency, opts.is_test ? 1 : 0);
    u = byId(id);
    created = true;
  } else if (opts.username && opts.username !== u.username) {
    db().prepare('UPDATE users SET username = ? WHERE id = ?').run(String(opts.username).slice(0, 64), u.id);
    u = byId(u.id);
  }
  return { player: u, created };
}

function amountOf(v) {
  const a = Number(v);
  if (!Number.isInteger(a) || a <= 0) throw bad('INVALID_AMOUNT', 'amount must be a positive integer in minor units');
  return a;
}

function findLedger(merchantId, type, txId) {
  if (!txId) return null;
  return db().prepare('SELECT * FROM wallet_ledger WHERE merchant_id = ? AND type = ? AND ext_tx_id = ?').get(merchantId, type, String(txId)) || null;
}

function transfer(merchant, externalId, rawAmount, txId, type, actor) {
  const amount = amountOf(rawAmount);
  if (!txId || String(txId).length > 64) throw bad('INVALID_TX_ID', 'tx_id (your unique transaction id, max 64 chars) is required');
  return dbService.tx(() => {
    const prev = findLedger(merchant.id, type, txId);
    if (prev) {
      const u = byId(prev.user_id);
      if (!u || u.external_id !== String(externalId) || prev.amount !== (type === 'deposit' ? amount : -amount)) {
        throw new ApiError(409, 'DUPLICATE_TX_ID', 'tx_id already used for a different operation');
      }
      return { idempotent: true, tx: prev, player: u };
    }
    const u = mustByExternal(merchant.id, externalId);
    if (u.status !== 'active') throw new ApiError(403, 'PLAYER_BLOCKED', 'Player is blocked');
    const m = db().prepare('SELECT * FROM merchants WHERE id = ?').get(merchant.id);
    // Test accounts play with QA money: deposits are not drawn from the float and nothing can be withdrawn.
    if (u.is_test && type === 'withdraw') throw new ApiError(403, 'TEST_PLAYER_NO_WITHDRAW', 'Test accounts cannot withdraw');
    const useFloat = !m.float_unlimited && !u.is_test;
    if (type === 'deposit') {
      if (useFloat && m.float_balance < amount) throw bad('INSUFFICIENT_FLOAT', 'Merchant float balance is too low for this deposit', { float_balance: m.float_balance });
      db().prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, u.id);
      if (useFloat) db().prepare('UPDATE merchants SET float_balance = float_balance - ? WHERE id = ?').run(amount, m.id);
    } else {
      const r = db().prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?').run(amount, u.id, amount);
      if (!r.changes) throw bad('INSUFFICIENT_FUNDS', 'Player balance is too low', { balance: u.balance });
      if (useFloat) db().prepare('UPDATE merchants SET float_balance = float_balance + ? WHERE id = ?').run(amount, m.id);
    }
    const after = byId(u.id);
    const floatAfter = db().prepare('SELECT float_balance FROM merchants WHERE id = ?').get(m.id).float_balance;
    const res = db().prepare(`INSERT INTO wallet_ledger (merchant_id, user_id, type, amount, player_balance_after, float_after, ext_tx_id, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(m.id, u.id, type, type === 'deposit' ? amount : -amount, after.balance, floatAfter, String(txId), actor);
    return { idempotent: false, tx: db().prepare('SELECT * FROM wallet_ledger WHERE id = ?').get(res.lastInsertRowid), player: after };
  });
}

const deposit = (merchant, ext, amount, txId, actor = 'api') => transfer(merchant, ext, amount, txId, 'deposit', actor);
const withdraw = (merchant, ext, amount, txId, actor = 'api') => transfer(merchant, ext, amount, txId, 'withdraw', actor);

/** Admin correction of a player balance (does not touch the merchant float). */
function adminAdjust(userId, rawAmount, note, actor) {
  const a = Math.trunc(Number(rawAmount));
  if (!a) throw bad('INVALID_AMOUNT', 'amount must be a non-zero integer');
  return dbService.tx(() => {
    const u = byId(userId);
    if (!u) throw notFound('PLAYER_NOT_FOUND', 'Player not found');
    if (u.balance + a < 0) throw bad('INSUFFICIENT_FUNDS', 'Balance cannot go negative');
    db().prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(a, u.id);
    const after = byId(u.id);
    db().prepare('INSERT INTO wallet_ledger (merchant_id, user_id, type, amount, player_balance_after, note, actor) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.merchant_id, u.id, 'admin_adjust', a, after.balance, note || null, actor);
    dbService.audit(actor, 'player.adjust_balance', `player:${u.id}`, { amount: a, note });
    return present(after);
  });
}

function setFlags(userId, patch, actor) {
  const u = byId(userId);
  if (!u) throw notFound('PLAYER_NOT_FOUND', 'Player not found');
  if (patch.is_test !== undefined) db().prepare('UPDATE users SET is_test = ? WHERE id = ?').run(patch.is_test ? 1 : 0, u.id);
  if (patch.status !== undefined) {
    if (!['active', 'blocked'].includes(patch.status)) throw bad('INVALID_STATUS', 'status: active | blocked');
    db().prepare('UPDATE users SET status = ? WHERE id = ?').run(patch.status, u.id);
  }
  dbService.audit(actor, 'player.update', `player:${u.id}`, patch);
  return present(byId(u.id));
}

function list({ merchantId = null, q = '', limit = 50, offset = 0, testOnly = false } = {}) {
  const where = [];
  const args = [];
  if (merchantId) { where.push('u.merchant_id = ?'); args.push(merchantId); }
  if (testOnly) where.push('u.is_test = 1');
  if (q) { where.push('(u.external_id LIKE ? OR u.username LIKE ? OR CAST(u.id AS TEXT) = ?)'); args.push(`%${q}%`, `%${q}%`, q); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db().prepare(`
    SELECT u.*, m.code AS merchant_code, m.currency AS merchant_currency,
      (SELECT COUNT(*) FROM rgs_transactions t WHERE t.user_id = u.id) AS rounds,
      (SELECT COALESCE(SUM(bet_amount),0) FROM rgs_transactions t WHERE t.user_id = u.id) AS total_bet,
      (SELECT COALESCE(SUM(win_amount),0) FROM rgs_transactions t WHERE t.user_id = u.id) AS total_win
    FROM users u LEFT JOIN merchants m ON m.id = u.merchant_id ${w}
    ORDER BY COALESCE(u.last_seen_at, u.created_at) DESC LIMIT ? OFFSET ?
  `).all(...args, Math.min(200, limit), offset);
  const total = db().prepare(`SELECT COUNT(*) AS n FROM users u ${w}`).get(...args).n;
  return {
    total,
    players: rows.map((r) => ({ ...present(r), merchant_code: r.merchant_code, currency: r.currency || r.merchant_currency, rounds: r.rounds, total_bet: r.total_bet, total_win: r.total_win }))
  };
}

function ledger({ merchantId = null, userId = null, limit = 50 } = {}) {
  const where = [];
  const args = [];
  if (merchantId) { where.push('l.merchant_id = ?'); args.push(merchantId); }
  if (userId) { where.push('l.user_id = ?'); args.push(userId); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db().prepare(`SELECT l.*, u.external_id, m.code AS merchant_code FROM wallet_ledger l
    LEFT JOIN users u ON u.id = l.user_id LEFT JOIN merchants m ON m.id = l.merchant_id ${w} ORDER BY l.id DESC LIMIT ?`).all(...args, Math.min(500, limit));
}

module.exports = { present, byExternal, mustByExternal, byId, getOrCreate, deposit, withdraw, adminAdjust, setFlags, list, ledger };
