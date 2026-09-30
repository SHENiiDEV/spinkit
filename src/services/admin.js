const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { dbService } = require('../db/database');
const { sha256, randomToken, hashPassword, verifyPassword } = require('./security');
const { ApiError, bad } = require('./errors');

const db = () => dbService.db;
const SESSION_HOURS = 12;
const CRED_FILE = path.join(path.dirname(process.env.SPINKIT_DB || path.join(__dirname, '../../data/spinkit.db')), 'admin-credentials.txt');

/**
 * Back-office users. On first start an "admin" account is created:
 *   - password from SPINKIT_ADMIN_PASSWORD if set,
 *   - otherwise a random one, printed to the console and saved to data/admin-credentials.txt.
 */
function bootstrap() {
  const n = db().prepare('SELECT COUNT(*) AS n FROM admin_users').get().n;
  if (n > 0) return null;
  const username = process.env.SPINKIT_ADMIN_USER || 'admin';
  const password = process.env.SPINKIT_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db().prepare('INSERT INTO admin_users (username, pass_hash, role) VALUES (?, ?, ?)').run(username, hashPassword(password), 'owner');
  if (!process.env.SPINKIT_ADMIN_PASSWORD) {
    try {
      fs.writeFileSync(CRED_FILE, `SpinKit admin panel\nURL:      /admin\nLogin:    ${username}\nPassword: ${password}\n\nChange the password after the first login and delete this file.\n`, { mode: 0o600 });
    } catch { /* read-only fs */ }
    console.log(`\n🔐 Admin account created — login: ${username}  password: ${password}\n   (also saved to ${CRED_FILE})\n`);
  }
  return { username, password };
}

// simple in-memory brute-force protection
const attempts = new Map();

function login(username, password, ip) {
  const key = `${ip}|${username}`;
  const a = attempts.get(key) || { n: 0, until: 0 };
  if (a.until > Date.now()) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts, try again in a minute');
  const u = db().prepare('SELECT * FROM admin_users WHERE username = ?').get(String(username || ''));
  if (!u || !verifyPassword(password, u.pass_hash)) {
    a.n += 1;
    if (a.n >= 5) { a.until = Date.now() + 60000; a.n = 0; }
    attempts.set(key, a);
    dbService.audit(String(username || '?'), 'admin.login_failed', null, null, ip);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong login or password');
  }
  attempts.delete(key);
  const token = randomToken('adm_', 32);
  db().prepare('INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), u.id, Date.now() + SESSION_HOURS * 3600e3);
  db().prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  dbService.audit(u.username, 'admin.login', null, null, ip);
  return { token, admin: { id: u.id, username: u.username, role: u.role }, max_age: SESSION_HOURS * 3600 };
}

function bySession(token) {
  if (!token) return null;
  const s = db().prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha256(token));
  if (!s || s.expires_at < Date.now()) return null;
  const u = db().prepare('SELECT id, username, role FROM admin_users WHERE id = ?').get(s.admin_id);
  return u || null;
}

function logout(token) {
  if (token) db().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
}

function changePassword(adminId, current, next) {
  const u = db().prepare('SELECT * FROM admin_users WHERE id = ?').get(adminId);
  if (!u || !verifyPassword(current, u.pass_hash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is wrong');
  if (!next || String(next).length < 10) throw bad('WEAK_PASSWORD', 'New password must be at least 10 characters');
  db().prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?').run(hashPassword(next), adminId);
  db().prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(adminId);
  dbService.audit(u.username, 'admin.change_password');
  try { fs.unlinkSync(CRED_FILE); } catch { /* ignore */ }
}

function listAdmins() {
  return db().prepare('SELECT id, username, role, created_at FROM admin_users ORDER BY id').all();
}

function createAdmin(username, password, role, actor) {
  if (!/^[\w.-]{3,32}$/.test(String(username || ''))) throw bad('INVALID_USERNAME', 'username: 3-32 chars');
  if (!password || String(password).length < 10) throw bad('WEAK_PASSWORD', 'Password must be at least 10 characters');
  if (!['owner', 'admin', 'viewer'].includes(role)) throw bad('INVALID_ROLE', 'role: owner | admin | viewer');
  try {
    db().prepare('INSERT INTO admin_users (username, pass_hash, role) VALUES (?, ?, ?)').run(username, hashPassword(password), role);
  } catch {
    throw new ApiError(409, 'DUPLICATE_USERNAME', 'Username already exists');
  }
  dbService.audit(actor, 'admin.create_user', `admin:${username}`, { role });
}

module.exports = { bootstrap, login, bySession, logout, changePassword, listAdmins, createAdmin };
