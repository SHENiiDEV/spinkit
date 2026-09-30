const crypto = require('node:crypto');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** Random URL-safe token with a readable prefix, e.g. sk_live_3kF9... */
function randomToken(prefix, bytes = 24) {
  return `${prefix}${crypto.randomBytes(bytes).toString('base64url')}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [algo, salt, hash] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** HMAC-SHA256 hex signature of the raw request body. */
function sign(secret, rawBody) {
  return crypto.createHmac('sha256', String(secret)).update(rawBody || '').digest('hex');
}

// ------------------------------------------------------------------ IP whitelist
function normalizeIp(ip) {
  if (!ip) return '';
  let v = String(ip).trim();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v === '::1') v = '127.0.0.1';
  return v;
}

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

/** Rule forms: "1.2.3.4", "10.0.0.0/8", "::1" (exact), "*" (any). */
function ipMatches(ip, rule) {
  const r = String(rule).trim();
  if (!r) return false;
  if (r === '*') return true;
  const addr = normalizeIp(ip);
  if (r.includes('/')) {
    const [net, bitsStr] = r.split('/');
    const bits = Number(bitsStr);
    const a = ipv4ToInt(addr);
    const n = ipv4ToInt(normalizeIp(net));
    if (a == null || n == null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (a & mask) === (n & mask);
  }
  return normalizeIp(r) === addr;
}

function isValidIpRule(rule) {
  const r = String(rule).trim();
  if (r === '*') return true;
  if (r.includes('/')) {
    const [net, bits] = r.split('/');
    return ipv4ToInt(net) != null && Number(bits) >= 0 && Number(bits) <= 32;
  }
  return ipv4ToInt(r) != null || /^[0-9a-f:]+$/i.test(r);
}

function ipAllowed(ip, list) {
  if (!Array.isArray(list) || list.length === 0) return true; // empty whitelist = allow all (shown as a warning in admin)
  return list.some((rule) => ipMatches(ip, rule));
}

function clientIp(req) {
  if (process.env.SPINKIT_TRUST_PROXY === '1') {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return normalizeIp(String(fwd).split(',')[0]);
  }
  return normalizeIp(req.socket && req.socket.remoteAddress);
}

module.exports = { sha256, randomToken, hashPassword, verifyPassword, safeEqual, sign, ipAllowed, ipMatches, isValidIpRule, normalizeIp, clientIp };
