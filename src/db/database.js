const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { GAMES_CATALOG } = require('../games/catalog');
const { CURRENCY, STARTING_BALANCE } = require('../config');

const DB_FILE = process.env.SPINKIT_DB || path.join(__dirname, '../../data/spinkit.db');

/**
 * SQLite storage (node:sqlite).
 *
 * Tables
 *   merchants, merchant_tokens, merchant_games      operators (casinos) and their settings
 *   users                                           players (merchant_id + external_id)
 *   session_tokens                                  game sessions (launch tokens)
 *   game_states                                     unfinished free spins per player/game
 *   rgs_transactions                                one row per round
 *   wallet_ledger                                   deposits / withdrawals / float movements
 *   jackpots, jackpot_wins                          progressive "must hit by" pools per merchant
 *   admin_users, admin_sessions, audit_log          back-office
 *
 * All money columns are integer minor units. Jackpot pools use milli-units
 * (1/1000 of a minor unit) so small contributions are not lost to rounding.
 */
class DatabaseService {
  constructor(file = DB_FILE) {
    const dataDir = path.dirname(file);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.initSchema();
    this.migrate();
    this.seedGames();
    this.seedDemo();
  }

  // ------------------------------------------------------------------ schema
  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        slug VARCHAR(64) UNIQUE NOT NULL,
        reels_count INT DEFAULT 5,
        rows_count INT DEFAULT 3,
        min_bet BIGINT NOT NULL DEFAULT 100,
        max_bet BIGINT NOT NULL DEFAULT 5000000,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        currency TEXT NOT NULL DEFAULT 'USD',
        float_balance BIGINT NOT NULL DEFAULT 0,
        float_unlimited INT NOT NULL DEFAULT 0,
        ip_whitelist TEXT NOT NULL DEFAULT '[]',
        require_signature INT NOT NULL DEFAULT 0,
        signing_secret TEXT,
        rtp_profile INT NOT NULL DEFAULT 96,
        min_bet BIGINT,
        max_bet BIGINT,
        max_win_x INT,
        jackpot_enabled INT NOT NULL DEFAULT 0,
        demo_refill INT NOT NULL DEFAULT 0,
        lobby_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS merchant_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL REFERENCES merchants(id),
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS merchant_games (
        merchant_id INTEGER NOT NULL REFERENCES merchants(id),
        game_id TEXT NOT NULL,
        enabled INT NOT NULL DEFAULT 1,
        rtp_profile INT,
        min_bet BIGINT,
        max_bet BIGINT,
        PRIMARY KEY (merchant_id, game_id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username VARCHAR(64) NOT NULL,
        balance BIGINT NOT NULL DEFAULT 10000000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id BIGINT NOT NULL,
        game_id VARCHAR(64) NOT NULL,
        free_spins_left INT DEFAULT 0,
        free_spins_multiplier INT DEFAULT 1,
        free_spins_bet BIGINT DEFAULT 0,
        free_spins_total_win BIGINT DEFAULT 0,
        active_bonus_data TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_game UNIQUE (user_id, game_id)
      );

      CREATE TABLE IF NOT EXISTS rgs_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round_id TEXT NOT NULL UNIQUE,
        user_id BIGINT NOT NULL,
        game_id VARCHAR(64) NOT NULL,
        bet_amount BIGINT NOT NULL,
        win_amount BIGINT NOT NULL,
        balance_before BIGINT NOT NULL,
        balance_after BIGINT NOT NULL,
        matrix TEXT NOT NULL,
        winning_lines TEXT NOT NULL,
        is_free_spin BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_rgs_tx_user_game ON rgs_transactions (user_id, game_id);
      CREATE INDEX IF NOT EXISTS idx_rgs_tx_created ON rgs_transactions (created_at DESC);

      CREATE TABLE IF NOT EXISTS session_tokens (
        token TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        game_id VARCHAR(64) NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        user_id BIGINT,
        type TEXT NOT NULL,
        amount BIGINT NOT NULL,
        player_balance_after BIGINT,
        float_after BIGINT,
        ext_tx_id TEXT,
        note TEXT,
        actor TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_ext ON wallet_ledger (merchant_id, type, ext_tx_id) WHERE ext_tx_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ledger_merchant ON wallet_ledger (merchant_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS jackpots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        tier TEXT NOT NULL,
        name TEXT NOT NULL,
        seed BIGINT NOT NULL,
        must_hit_by BIGINT NOT NULL,
        contribution_bp INT NOT NULL,
        min_bet BIGINT NOT NULL DEFAULT 0,
        enabled INT NOT NULL DEFAULT 1,
        current_milli BIGINT NOT NULL,
        hit_point_milli BIGINT NOT NULL,
        hits INT NOT NULL DEFAULT 0,
        total_paid BIGINT NOT NULL DEFAULT 0,
        last_hit_at TIMESTAMP,
        last_hit_amount BIGINT,
        sort INT NOT NULL DEFAULT 0,
        UNIQUE (merchant_id, tier)
      );

      CREATE TABLE IF NOT EXISTS jackpot_wins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        tier TEXT NOT NULL,
        user_id BIGINT NOT NULL,
        game_id TEXT,
        round_id TEXT,
        amount BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        pass_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        expires_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT,
        ip TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  columns(table) {
    return this.db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  }

  addColumn(table, name, ddl) {
    if (!this.columns(table).includes(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }

  migrate() {
    // players
    this.addColumn('users', 'merchant_id', 'INTEGER NOT NULL DEFAULT 1');
    this.addColumn('users', 'external_id', 'TEXT');
    this.addColumn('users', 'currency', 'TEXT');
    this.addColumn('users', 'is_test', 'INT NOT NULL DEFAULT 0');
    this.addColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'");
    this.addColumn('users', 'last_seen_at', 'TIMESTAMP');
    this.db.exec("UPDATE users SET external_id = CAST(id AS TEXT) WHERE external_id IS NULL");
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_merchant_ext ON users (merchant_id, external_id)');
    // merchants & games
    this.addColumn('merchants', 'guaranteed_win', 'INT NOT NULL DEFAULT 0');
    this.addColumn('merchants', 'wild_x1000', 'INT NOT NULL DEFAULT 0');
    this.addColumn('merchant_games', 'guaranteed_win', 'INT');
    this.addColumn('merchant_games', 'wild_x1000', 'INT');
    // sessions
    this.addColumn('session_tokens', 'merchant_id', 'INTEGER NOT NULL DEFAULT 1');
    this.addColumn('session_tokens', 'rtp_profile', 'INT');
    this.addColumn('session_tokens', 'test_mode', 'INT NOT NULL DEFAULT 0');
    this.addColumn('session_tokens', 'force_feature', 'INT NOT NULL DEFAULT 0');
    this.addColumn('session_tokens', 'guaranteed_win', 'INT NOT NULL DEFAULT 0');
    this.addColumn('session_tokens', 'wild_x1000', 'INT NOT NULL DEFAULT 0');
    this.addColumn('session_tokens', 'lobby_url', 'TEXT');
    this.addColumn('session_tokens', 'client_ip', 'TEXT');
    this.addColumn('session_tokens', 'spins', 'INT NOT NULL DEFAULT 0');
    this.addColumn('session_tokens', 'revoked', 'INT NOT NULL DEFAULT 0');
    // rounds
    this.addColumn('rgs_transactions', 'merchant_id', 'INTEGER NOT NULL DEFAULT 1');
    this.addColumn('rgs_transactions', 'rtp_profile', 'INT');
    this.addColumn('rgs_transactions', 'jackpot_win', 'BIGINT NOT NULL DEFAULT 0');
    this.addColumn('rgs_transactions', 'bet_type', "TEXT NOT NULL DEFAULT 'spin'");
    this.addColumn('rgs_transactions', 'session_token', 'TEXT');
    this.addColumn('rgs_transactions', 'test_mode', 'INT NOT NULL DEFAULT 0');
    this.addColumn('rgs_transactions', 'details', 'TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_rgs_tx_merchant ON rgs_transactions (merchant_id, created_at DESC)');
  }

  seedGames() {
    const insert = this.db.prepare(`
      INSERT INTO games (id, name, slug, reels_count, rows_count, min_bet, max_bet, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug,
        min_bet = excluded.min_bet, max_bet = excluded.max_bet
    `);
    this.db.exec('BEGIN');
    for (const g of Object.values(GAMES_CATALOG)) {
      insert.run(g.id, g.name, g.slug, g.reels_count, g.rows_count, g.min_bet, g.max_bet);
    }
    this.db.exec('COMMIT');
  }

  seedDemo() {
    // Merchant #1 "demo" powers the public lobby and the legacy /api/v1 endpoints.
    this.db.prepare(`
      INSERT INTO merchants (id, code, name, currency, float_unlimited, demo_refill, jackpot_enabled, notes)
      VALUES (1, 'demo', 'Demo Casino (public lobby)', ?, 1, 1, 1, 'Built-in merchant used by the public lobby and /api/v1.')
      ON CONFLICT(id) DO NOTHING
    `).run(CURRENCY.code);
    this.db.prepare(`
      INSERT INTO users (id, username, balance, merchant_id, external_id)
      VALUES (49102, 'VipPlayer', ?, 1, '49102') ON CONFLICT(id) DO NOTHING
    `).run(STARTING_BALANCE);
  }

  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ------------------------------------------------------------------ players (legacy API kept)
  nextUserId() {
    const row = this.db.prepare('SELECT MAX(id) AS m FROM users').get();
    return Math.max(1000000, Number(row.m || 0)) + 1;
  }

  getUser(userId) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (row) return row;
    // Legacy demo behaviour: unknown user ids are auto-created in the demo merchant.
    this.db.prepare('INSERT INTO users (id, username, balance, merchant_id, external_id) VALUES (?, ?, ?, 1, ?)')
      .run(userId, `Player_${userId}`, STARTING_BALANCE, String(userId));
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  findUser(userId) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
  }

  updateBalance(userId, newBalance) {
    this.db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
  }

  refillBalance(userId, addAmount = STARTING_BALANCE) {
    this.getUser(userId);
    this.db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(addAmount, userId);
    return this.getUser(userId);
  }

  // ------------------------------------------------------------------ games
  getAllGames() {
    return this.db.prepare('SELECT * FROM games WHERE is_active = 1').all();
  }

  getGameById(gameId) {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  }

  // ------------------------------------------------------------------ game state
  getGameState(userId, gameId) {
    let state = this.db.prepare('SELECT * FROM game_states WHERE user_id = ? AND game_id = ?').get(userId, gameId);
    if (!state) {
      this.db.prepare(`INSERT INTO game_states (user_id, game_id, free_spins_left, free_spins_multiplier, free_spins_bet, free_spins_total_win)
        VALUES (?, ?, 0, 1, 0, 0)`).run(userId, gameId);
      state = this.db.prepare('SELECT * FROM game_states WHERE user_id = ? AND game_id = ?').get(userId, gameId);
    }
    return state;
  }

  updateGameState(userId, gameId, updates) {
    const cur = this.getGameState(userId, gameId);
    const pick = (k) => (updates[k] !== undefined ? updates[k] : cur[k]);
    this.db.prepare(`
      UPDATE game_states SET free_spins_left = ?, free_spins_multiplier = ?, free_spins_bet = ?,
        free_spins_total_win = ?, active_bonus_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND game_id = ?
    `).run(pick('free_spins_left'), pick('free_spins_multiplier'), pick('free_spins_bet'), pick('free_spins_total_win'),
      pick('active_bonus_data'), userId, gameId);
  }

  // ------------------------------------------------------------------ sessions
  createSessionToken(token, userId, gameId, ttlMinutes = 60, extra = {}) {
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const user = this.findUser(userId);
    this.db.prepare(`
      INSERT INTO session_tokens (token, user_id, game_id, expires_at, merchant_id, rtp_profile, test_mode, force_feature, guaranteed_win, wild_x1000, lobby_url, client_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, game_id = excluded.game_id, expires_at = excluded.expires_at
    `).run(token, userId, gameId, expiresAt, extra.merchant_id || (user ? user.merchant_id : 1),
      extra.rtp_profile == null ? null : extra.rtp_profile, extra.test_mode ? 1 : 0, extra.force_feature ? 1 : 0,
      extra.guaranteed_win ? 1 : 0, extra.wild_x1000 ? 1 : 0,
      extra.lobby_url || null, extra.client_ip || null);
    return { token, expires_at: expiresAt };
  }

  getSession(token) {
    const s = this.db.prepare('SELECT * FROM session_tokens WHERE token = ?').get(token);
    if (!s) return null;
    if (s.revoked || Date.now() > s.expires_at) return null;
    return s;
  }

  // ------------------------------------------------------------------ rounds
  recordTransaction(t) {
    this.db.prepare(`
      INSERT INTO rgs_transactions (round_id, user_id, game_id, bet_amount, win_amount, balance_before, balance_after,
        matrix, winning_lines, is_free_spin, merchant_id, rtp_profile, jackpot_win, bet_type, session_token, test_mode, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(t.round_id, t.user_id, t.game_id, t.bet_amount, t.win_amount, t.balance_before, t.balance_after,
      JSON.stringify(t.matrix), JSON.stringify(t.winning_lines), t.is_free_spin ? 1 : 0,
      t.merchant_id || 1, t.rtp_profile == null ? null : t.rtp_profile, t.jackpot_win || 0, t.bet_type || 'spin',
      t.session_token || null, t.test_mode ? 1 : 0, t.details ? JSON.stringify(t.details) : null);
  }

  mapTx(r) {
    return {
      ...r,
      matrix: JSON.parse(r.matrix),
      winning_lines: JSON.parse(r.winning_lines),
      details: r.details ? JSON.parse(r.details) : null,
      is_free_spin: !!r.is_free_spin,
      test_mode: !!r.test_mode
    };
  }

  getRecentTransactions(userId, limit = 20) {
    return this.db.prepare('SELECT * FROM rgs_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit).map((r) => this.mapTx(r));
  }

  getAllRecentTransactions(limit = 30) {
    return this.db.prepare(`
      SELECT t.*, g.name AS game_name FROM rgs_transactions t LEFT JOIN games g ON t.game_id = g.id
      ORDER BY t.id DESC LIMIT ?
    `).all(limit).map((r) => this.mapTx(r));
  }

  // ------------------------------------------------------------------ audit
  audit(actor, action, target = null, details = null, ip = null) {
    this.db.prepare('INSERT INTO audit_log (actor, action, target, details, ip) VALUES (?, ?, ?, ?, ?)')
      .run(actor, action, target, details ? JSON.stringify(details) : null, ip);
  }
}

const dbService = new DatabaseService();

module.exports = { dbService, DatabaseService };
