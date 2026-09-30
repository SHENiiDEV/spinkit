const crypto = require('node:crypto');
const { dbService } = require('../db/database');
const { bad, notFound } = require('./errors');

/**
 * Progressive "Must Hit By" jackpots (per merchant, shared by all its games).
 *
 * Every paid bet contributes contribution_bp / 10,000 of the stake to each enabled tier.
 * When a pool is (re)seeded, a secret hit point is drawn uniformly between the
 * current pool and must_hit_by. The spin whose contribution pushes the pool past
 * the hit point wins it. So every pool is guaranteed to drop before it reaches
 * must_hit_by, and 100% of contributions go back to players.
 *
 * Pools are stored in milli-units (1/1000 minor unit) so tiny contributions add up exactly.
 */

const db = () => dbService.db;
const M = 1000;

const DEFAULT_TIERS = [
  { tier: 'mini', name: 'MINI', seed: 1000, must_hit_by: 5000, contribution_bp: 20, min_bet: 0, sort: 1 },
  { tier: 'minor', name: 'MINOR', seed: 5000, must_hit_by: 25000, contribution_bp: 15, min_bet: 0, sort: 2 },
  { tier: 'major', name: 'MAJOR', seed: 50000, must_hit_by: 250000, contribution_bp: 10, min_bet: 0, sort: 3 },
  { tier: 'grand', name: 'GRAND', seed: 500000, must_hit_by: 2500000, contribution_bp: 5, min_bet: 100, sort: 4 }
];

function drawHitPoint(fromMilli, mustHitBy) {
  const top = mustHitBy * M;
  const span = Math.max(1, top - fromMilli);
  // crypto.randomInt supports ranges < 2^48
  return fromMilli + 1 + crypto.randomInt(0, Math.min(span, 2 ** 47));
}

function ensureDefaults(merchantId) {
  const insert = db().prepare(`
    INSERT INTO jackpots (merchant_id, tier, name, seed, must_hit_by, contribution_bp, min_bet, current_milli, hit_point_milli, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(merchant_id, tier) DO NOTHING
  `);
  for (const t of DEFAULT_TIERS) {
    insert.run(merchantId, t.tier, t.name, t.seed, t.must_hit_by, t.contribution_bp, t.min_bet, t.seed * M, drawHitPoint(t.seed * M, t.must_hit_by), t.sort);
  }
}

function present(j) {
  return {
    tier: j.tier,
    name: j.name,
    amount: Math.floor(j.current_milli / M),
    seed: j.seed,
    must_hit_by: j.must_hit_by,
    contribution_pct: j.contribution_bp / 100,
    min_bet: j.min_bet,
    enabled: !!j.enabled,
    hits: j.hits,
    total_paid: j.total_paid,
    last_hit_at: j.last_hit_at,
    last_hit_amount: j.last_hit_amount
  };
}

function list(merchantId, { onlyEnabled = false } = {}) {
  const rows = db().prepare(`SELECT * FROM jackpots WHERE merchant_id = ? ${onlyEnabled ? 'AND enabled = 1' : ''} ORDER BY sort`).all(merchantId);
  return rows.map(present);
}

/** Public ticker values for the game client / lobby (empty when the merchant has jackpots off). */
function ticker(merchant) {
  if (!merchant || !merchant.jackpot_enabled) return [];
  return list(merchant.id, { onlyEnabled: true }).map((j) => ({ tier: j.tier, name: j.name, amount: j.amount, min_bet: j.min_bet }));
}

function update(merchantId, tier, patch, actor) {
  const j = db().prepare('SELECT * FROM jackpots WHERE merchant_id = ? AND tier = ?').get(merchantId, tier);
  if (!j) throw notFound('JACKPOT_NOT_FOUND', `Jackpot tier ${tier} not found`);
  const next = { ...j };
  if (patch.name !== undefined) next.name = String(patch.name).slice(0, 24).toUpperCase();
  if (patch.seed !== undefined) next.seed = Math.floor(Number(patch.seed));
  if (patch.must_hit_by !== undefined) next.must_hit_by = Math.floor(Number(patch.must_hit_by));
  if (patch.contribution_pct !== undefined) next.contribution_bp = Math.round(Number(patch.contribution_pct) * 100);
  if (patch.min_bet !== undefined) next.min_bet = Math.max(0, Math.floor(Number(patch.min_bet) || 0));
  if (patch.enabled !== undefined) next.enabled = patch.enabled ? 1 : 0;
  if (!(next.seed > 0)) throw bad('INVALID_JACKPOT', 'seed must be > 0');
  if (!(next.must_hit_by > next.seed)) throw bad('INVALID_JACKPOT', 'must_hit_by must be greater than seed');
  if (!(next.contribution_bp >= 0 && next.contribution_bp <= 500)) throw bad('INVALID_JACKPOT', 'contribution must be 0% – 5%');
  // Keep the pool inside the new range and redraw the hit point if it no longer fits
  if (next.current_milli < next.seed * M) next.current_milli = next.seed * M;
  if (next.current_milli >= next.must_hit_by * M) next.current_milli = next.seed * M;
  if (next.hit_point_milli <= next.current_milli || next.hit_point_milli > next.must_hit_by * M || patch.must_hit_by !== undefined) {
    next.hit_point_milli = drawHitPoint(next.current_milli, next.must_hit_by);
  }
  db().prepare(`UPDATE jackpots SET name = ?, seed = ?, must_hit_by = ?, contribution_bp = ?, min_bet = ?, enabled = ?,
    current_milli = ?, hit_point_milli = ? WHERE id = ?`)
    .run(next.name, next.seed, next.must_hit_by, next.contribution_bp, next.min_bet, next.enabled, next.current_milli, next.hit_point_milli, j.id);
  dbService.audit(actor, 'jackpot.update', `merchant:${merchantId}`, { tier, ...patch });
  return present(db().prepare('SELECT * FROM jackpots WHERE id = ?').get(j.id));
}

function reset(merchantId, tier, actor) {
  const j = db().prepare('SELECT * FROM jackpots WHERE merchant_id = ? AND tier = ?').get(merchantId, tier);
  if (!j) throw notFound('JACKPOT_NOT_FOUND', `Jackpot tier ${tier} not found`);
  const cur = j.seed * M;
  db().prepare('UPDATE jackpots SET current_milli = ?, hit_point_milli = ? WHERE id = ?').run(cur, drawHitPoint(cur, j.must_hit_by), j.id);
  dbService.audit(actor, 'jackpot.reset', `merchant:${merchantId}`, { tier, previous_amount: Math.floor(j.current_milli / M) });
}

/**
 * Adds a paid bet's contribution to every eligible tier. Must run inside the spin transaction.
 * Returns the list of jackpot wins triggered by this bet.
 */
function contribute(merchant, bet, ctx) {
  if (!merchant || !merchant.jackpot_enabled || !(bet > 0)) return [];
  const rows = db().prepare('SELECT * FROM jackpots WHERE merchant_id = ? AND enabled = 1 ORDER BY sort').all(merchant.id);
  const wins = [];
  const upd = db().prepare('UPDATE jackpots SET current_milli = ?, hit_point_milli = ?, hits = ?, total_paid = ?, last_hit_at = ?, last_hit_amount = ? WHERE id = ?');
  for (const j of rows) {
    if (bet < j.min_bet || j.contribution_bp <= 0) continue;
    let current = j.current_milli + Math.floor((bet * j.contribution_bp * M) / 10000);
    let hit = j.hit_point_milli;
    let { hits, total_paid: paid, last_hit_at: lastAt, last_hit_amount: lastAmt } = j;
    if (current >= hit) {
      const amount = Math.floor(Math.min(current, j.must_hit_by * M) / M);
      const overflow = current - amount * M; // carried into the next pool so nothing is lost
      current = j.seed * M + overflow;
      hit = drawHitPoint(current, j.must_hit_by);
      hits += 1;
      paid += amount;
      lastAt = new Date().toISOString();
      lastAmt = amount;
      db().prepare('INSERT INTO jackpot_wins (merchant_id, tier, user_id, game_id, round_id, amount) VALUES (?, ?, ?, ?, ?, ?)')
        .run(merchant.id, j.tier, ctx.userId, ctx.gameId, ctx.roundId, amount);
      wins.push({ tier: j.tier, name: j.name, amount });
    }
    upd.run(current, hit, hits, paid, lastAt, lastAmt, j.id);
  }
  return wins;
}

function recentWins(merchantId, limit = 50) {
  const where = merchantId ? 'WHERE w.merchant_id = ?' : '';
  const args = merchantId ? [merchantId, limit] : [limit];
  return db().prepare(`
    SELECT w.*, u.external_id, u.username, m.code AS merchant_code FROM jackpot_wins w
    LEFT JOIN users u ON u.id = w.user_id LEFT JOIN merchants m ON m.id = w.merchant_id
    ${where} ORDER BY w.id DESC LIMIT ?
  `).all(...args);
}

module.exports = { DEFAULT_TIERS, ensureDefaults, list, ticker, update, reset, contribute, recentWins };

// The built-in demo merchant always has its pools ready.
ensureDefaults(1);
