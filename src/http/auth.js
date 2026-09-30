const merchants = require('../services/merchants');
const admin = require('../services/admin');
const { ipAllowed, sign, safeEqual } = require('../services/security');
const { ApiError } = require('../services/errors');

const SIGNATURE_WINDOW_SEC = 300;

/**
 * Merchant API authentication:
 *   Authorization: Bearer sk_live_...     (required)
 *   caller IP must match the merchant IP whitelist (if the whitelist is not empty)
 *   if the merchant requires signatures:
 *     X-Timestamp: <unix seconds>
 *     X-Signature: hex HMAC-SHA256(signing_secret, `${timestamp}.${METHOD}.${path_with_query}.${raw_body}`)
 */
function merchantAuth(ctx) {
  const header = String(ctx.req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing "Authorization: Bearer <api token>" header');
  const m = merchants.authenticate(token);
  if (!m) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or revoked API token');
  if (m.status !== 'active') throw new ApiError(403, 'MERCHANT_SUSPENDED', 'Merchant is suspended');
  const whitelist = JSON.parse(m.ip_whitelist || '[]');
  if (!ipAllowed(ctx.ip, whitelist)) throw new ApiError(403, 'IP_NOT_WHITELISTED', `IP ${ctx.ip} is not in the merchant whitelist`, { ip: ctx.ip });
  if (m.require_signature) {
    const ts = Number(ctx.req.headers['x-timestamp']);
    const sig = String(ctx.req.headers['x-signature'] || '');
    if (!ts || !sig) throw new ApiError(401, 'SIGNATURE_REQUIRED', 'X-Timestamp and X-Signature headers are required');
    if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_WINDOW_SEC) throw new ApiError(401, 'SIGNATURE_EXPIRED', 'X-Timestamp is outside the allowed window (5 min)');
    const expected = sign(m.signing_secret, `${ts}.${ctx.method}.${ctx.pathWithQuery}.${ctx.rawBody || ''}`);
    if (!safeEqual(expected, sig.toLowerCase())) throw new ApiError(401, 'INVALID_SIGNATURE', 'Signature does not match');
  }
  ctx.merchant = m;
}

const COOKIE = 'sk_admin';

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function adminAuth(ctx) {
  const token = readCookie(ctx.req, COOKIE);
  const a = admin.bySession(token);
  if (!a) throw new ApiError(401, 'UNAUTHORIZED', 'Please log in');
  if (a.role === 'viewer' && ctx.method !== 'GET') throw new ApiError(403, 'READ_ONLY', 'Viewer accounts are read-only');
  ctx.admin = a;
  ctx.actor = `admin:${a.username}`;
}

function setAdminCookie(res, token, maxAge) {
  const secure = process.env.SPINKIT_SECURE_COOKIES === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

module.exports = { merchantAuth, adminAuth, readCookie, setAdminCookie, clearAdminCookie, COOKIE };
