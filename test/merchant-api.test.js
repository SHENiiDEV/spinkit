/**
 * End-to-end test of the admin + Merchant API v2 on a throw-away database.
 *   node test/merchant-api.test.js
 */
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spinkit-'));
process.env.SPINKIT_DB = path.join(tmp, 'test.db');
process.env.SPINKIT_ADMIN_PASSWORD = 'test-password-123';
process.env.SPINKIT_QUIET = '1';

const { startServer } = require('../src/server');
const PORT = 3097;
const BASE = `http://localhost:${PORT}`;

let cookie = '';
async function call(method, url, body, headers = {}) {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: raw });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const data = await res.json();
  return { status: res.status, data };
}

(async () => {
  const server = await startServer(PORT);
  try {
    // ------------------------------------------------ admin
    let r = await call('GET', '/api/admin/merchants');
    assert.strictEqual(r.status, 401, 'admin API needs login');
    r = await call('POST', '/api/admin/login', { username: 'admin', password: 'wrong' });
    assert.strictEqual(r.status, 401);
    r = await call('POST', '/api/admin/login', { username: 'admin', password: 'test-password-123' });
    assert.strictEqual(r.status, 200);
    console.log('✔ admin login');

    r = await call('POST', '/api/admin/merchants', { code: 'lucky', name: 'Lucky Casino', currency: 'EUR', float_balance: 1000000 });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    const merchantId = r.data.merchant.id;
    const token = r.data.token.token;
    assert(token.startsWith('sk_live_'));
    console.log('✔ merchant + API token created');

    const api = (m, u, b, h = {}) => call(m, u, b, { Authorization: `Bearer ${token}`, Cookie: '', ...h });

    // ------------------------------------------------ auth
    r = await call('GET', '/api/v2/merchant', undefined, { Cookie: '' });
    assert.strictEqual(r.status, 401);
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.merchant.currency, 'EUR');
    assert.strictEqual(r.data.merchant.currency_info.symbol, '€');

    // IP whitelist
    await call('PATCH', `/api/admin/merchants/${merchantId}`, { ip_whitelist: ['10.0.0.0/8'] });
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.data.error, 'IP_NOT_WHITELISTED');
    await call('PATCH', `/api/admin/merchants/${merchantId}`, { ip_whitelist: ['127.0.0.1', '10.0.0.0/8'] });
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.status, 200);
    console.log('✔ bearer auth + IP whitelist (CIDR)');

    // HMAC signature
    const detail = await call('GET', `/api/admin/merchants/${merchantId}`);
    const secret = detail.data.merchant.signing_secret;
    await call('PATCH', `/api/admin/merchants/${merchantId}`, { require_signature: true });
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.data.error, 'SIGNATURE_REQUIRED');
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.GET./api/v2/merchant.`).digest('hex');
    r = await api('GET', '/api/v2/merchant', undefined, { 'X-Timestamp': String(ts), 'X-Signature': sig });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/v2/merchant', undefined, { 'X-Timestamp': String(ts), 'X-Signature': sig.replace(/.$/, '0') === sig ? sig.replace(/.$/, '1') : sig.replace(/.$/, '0') });
    assert.strictEqual(r.data.error, 'INVALID_SIGNATURE');
    await call('PATCH', `/api/admin/merchants/${merchantId}`, { require_signature: false });
    console.log('✔ HMAC request signing');

    // ------------------------------------------------ games, limits, RTP profiles
    await call('PATCH', `/api/admin/merchants/${merchantId}`, { rtp_profile: 94, min_bet: 100, max_bet: 2000 });
    await call('PATCH', `/api/admin/merchants/${merchantId}/games/vegas_fruits`, { enabled: false });
    await call('PATCH', `/api/admin/merchants/${merchantId}/games/olympus_thunder`, { rtp_profile: 92 });
    r = await api('GET', '/api/v2/games');
    assert.strictEqual(r.status, 200);
    assert(!r.data.games.find((g) => g.game_id === 'vegas_fruits'), 'disabled game hidden');
    const oly = r.data.games.find((g) => g.game_id === 'olympus_thunder');
    assert.strictEqual(oly.rtp, '92.00%');
    assert(oly.bets.min >= 100 && oly.bets.max <= 2000, 'bet limits applied');
    assert.strictEqual(r.data.games.find((g) => g.game_id === 'pharaoh_riches').rtp, '94.00%');
    console.log('✔ per-merchant / per-game RTP profiles, bet limits, disabled games');

    // ------------------------------------------------ collections: bulk on / off by artwork
    r = await call('PATCH', `/api/admin/merchants/${merchantId}/games/*`, { enabled: false, filter: { collection: 'basic' } });
    assert(r.data.game.updated > 50, 'all basic games switched off');
    r = await api('GET', '/api/v2/games');
    assert(r.data.games.length > 0 && r.data.games.every((g) => g.collection === 'artwork'), 'only games with artwork left');
    r = await api('GET', '/api/v2/games?collection=basic');
    assert.strictEqual(r.data.count, 0);
    r = await call('GET', `/api/admin/merchants/${merchantId}/games`);
    assert(r.data.games.every((g) => (g.collection === 'basic' ? !g.enabled : true)));
    await call('PATCH', `/api/admin/merchants/${merchantId}/games/*`, { enabled: true, filter: { collection: 'basic' } });
    await call('PATCH', `/api/admin/merchants/${merchantId}/games/vegas_fruits`, { enabled: false });
    r = await api('GET', '/api/v2/games?collection=basic');
    assert(r.data.count > 50 && !r.data.games.find((g) => g.game_id === 'vegas_fruits'), 'basic games back, vegas still off');
    console.log('✔ game collections: artwork / basic, bulk enable & disable');

    // public lobby (/api/v1/games) follows the demo merchant's (#1) on/off settings
    r = await call('GET', '/api/v1/games');
    const allPublic = r.data.games.length;
    await call('PATCH', '/api/admin/merchants/1/games/*', { enabled: false, filter: { collection: 'basic' } });
    r = await call('GET', '/api/v1/games');
    assert(r.data.games.length > 0 && r.data.games.length < allPublic && r.data.games.every((g) => g.collection === 'artwork'), 'public lobby hides disabled games');
    await call('PATCH', '/api/admin/merchants/1/games/*', { enabled: true, filter: { collection: 'basic' } });
    r = await call('GET', '/api/v1/games');
    assert.strictEqual(r.data.games.length, allPublic);
    console.log('✔ public lobby hides games disabled for the demo merchant');

    // ------------------------------------------------ players & wallet
    r = await api('POST', '/api/v2/players', { external_id: 'u-1', username: 'Alice' });
    assert.strictEqual(r.data.player.balance, 0);
    r = await api('POST', '/api/v2/players/u-1/deposit', { amount: 50000, tx_id: 'd1' });
    assert.strictEqual(r.data.balance, 50000);
    r = await api('POST', '/api/v2/players/u-1/deposit', { amount: 50000, tx_id: 'd1' });
    assert.strictEqual(r.data.idempotent, true);
    assert.strictEqual(r.data.balance, 50000, 'idempotent deposit');
    r = await api('POST', '/api/v2/players/u-1/deposit', { amount: 99999999, tx_id: 'd2' });
    assert.strictEqual(r.data.error, 'INSUFFICIENT_FLOAT');
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.data.merchant.float_balance, 1000000 - 50000);
    console.log('✔ deposit (idempotent, float checked)');

    // ------------------------------------------------ session + play
    r = await api('POST', '/api/v2/sessions', { external_id: 'u-1', game_id: 'vegas_fruits' });
    assert.strictEqual(r.data.error, 'GAME_DISABLED');
    r = await api('POST', '/api/v2/sessions', { external_id: 'u-1', game_id: 'olympus_thunder', test: { rtp_profile: 150 } });
    assert.strictEqual(r.data.error, 'TEST_PLAYER_REQUIRED', 'real players cannot get RTP overrides');
    r = await api('POST', '/api/v2/sessions', { external_id: 'u-1', game_id: 'olympus_thunder' });
    assert.strictEqual(r.status, 200);
    const sToken = r.data.session.token;
    let init = await call('POST', '/api/v1/rgs/init', { token: sToken });
    assert.strictEqual(init.data.game_config.rtp, '92.00%');
    assert.strictEqual(init.data.game_config.currency.code, 'EUR');
    assert.strictEqual(init.data.jackpots.length, 4);
    assert.strictEqual(init.data.session.refill_enabled, false);
    const bet = init.data.game_config.bet_steps[0];
    let bal = init.data.user.balance;
    for (let i = 0; i < 30; i++) {
      const s = await call('POST', '/api/v1/rgs/spin', { token: sToken, bet_amount: bet });
      assert.strictEqual(s.status, 200, JSON.stringify(s.data));
      const jp = s.data.jackpot_wins.reduce((a, w) => a + w.amount, 0);
      assert.strictEqual(s.data.balance, bal - s.data.cost + s.data.total_win + jp);
      bal = s.data.balance;
    }
    r = await call('POST', '/api/v1/rgs/refill', { token: sToken });
    assert.strictEqual(r.data.error, 'REFILL_DISABLED');
    r = await api('GET', '/api/v2/jackpots');
    assert(r.data.jackpots[0].amount > 1000, 'jackpot pools grow with bets');
    r = await api('GET', '/api/v2/rounds?external_id=u-1&limit=5');
    assert.strictEqual(r.data.total, 30);
    const rid = r.data.rounds[0].round_id;
    r = await api('GET', `/api/v2/rounds/${rid}`);
    assert.strictEqual(r.data.round.rtp_profile, 92);
    console.log('✔ session launch, spins, balances, jackpot contributions, round history');

    r = await api('POST', '/api/v2/players/u-1/withdraw', { amount: bal, tx_id: 'w1' });
    assert.strictEqual(r.data.balance, 0);
    r = await api('GET', '/api/v2/reports/summary?days=1');
    assert.strictEqual(r.data.summary.rounds, 30);
    console.log('✔ withdraw + reports');

    // ------------------------------------------------ QA test sessions
    r = await call('POST', '/api/admin/players', { merchant_id: merchantId, external_id: 'qa-1', is_test: true });
    const qaId = r.data.player.player_id;
    await api('POST', '/api/v2/players/qa-1/deposit', { amount: 100000, tx_id: 'qa-d1' });
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.data.merchant.float_balance, 1000000 - 50000 + bal, 'test deposits do not use float');
    r = await call('POST', '/api/admin/sessions', { player_id: qaId, game_id: 'pharaoh_riches', rtp_profile: 150, force_feature: true });
    assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    const qaToken = r.data.session.token;
    init = await call('POST', '/api/v1/rgs/init', { token: qaToken });
    assert.strictEqual(init.data.session.test_mode, true);
    assert.strictEqual(init.data.game_config.rtp, '150.00%');
    const s = await call('POST', '/api/v1/rgs/spin', { token: qaToken, bet_amount: init.data.game_config.default_bet });
    assert(s.data.free_spins.remaining > 0, 'forced feature triggered');
    r = await api('POST', '/api/v2/players/qa-1/withdraw', { amount: 1, tx_id: 'qa-w1' });
    assert.strictEqual(r.data.error, 'TEST_PLAYER_NO_WITHDRAW');
    r = await call('GET', '/api/admin/audit');
    assert(r.data.audit.find((a) => a.action === 'session.test_create'), 'test session audited');
    console.log('✔ QA sessions: custom RTP + forced feature only for test players, audited, no withdrawals');

    // ------------------------------------------------ jackpot hit mechanics
    await call('PATCH', `/api/admin/merchants/${merchantId}/jackpots/mini`, { seed: 100, must_hit_by: 101, contribution_pct: 5 });
    r = await api('POST', '/api/v2/sessions', { external_id: 'u-1', game_id: 'pharaoh_riches' });
    await api('POST', '/api/v2/players/u-1/deposit', { amount: 10000, tx_id: 'd3' });
    const jt = r.data.session.token;
    const i2 = await call('POST', '/api/v1/rgs/init', { token: jt });
    let hit = null;
    for (let i = 0; i < 20 && !hit; i++) {
      const sp = await call('POST', '/api/v1/rgs/spin', { token: jt, bet_amount: i2.data.game_config.bet_steps[0] });
      hit = sp.data.jackpot_wins.find((w) => w.tier === 'mini');
    }
    assert(hit && hit.amount >= 100 && hit.amount <= 101, 'must-hit-by jackpot drops before the cap');
    r = await api('GET', '/api/v2/jackpots/wins');
    assert(r.data.wins.length >= 1);
    console.log('✔ must-hit-by jackpot pays out');

    // ------------------------------------------------ admin dashboard & docs
    r = await call('GET', '/api/admin/dashboard?days=7');
    assert(r.data.totals.rounds >= 30);
    r = await call('GET', '/api/openapi.json');
    assert(r.data.paths['/api/v2/sessions']);
    // token revoke
    const tokens = (await call('GET', `/api/admin/merchants/${merchantId}`)).data.tokens;
    await call('DELETE', `/api/admin/merchants/${merchantId}/tokens/${tokens[0].id}`);
    r = await api('GET', '/api/v2/merchant');
    assert.strictEqual(r.status, 401, 'revoked token rejected');
    // public demo endpoints cannot touch this merchant's players
    r = await call('POST', '/api/v1/games/launch', { user_id: qaId, game_id: 'pharaoh_riches' });
    assert.strictEqual(r.status, 403);
    console.log('✔ dashboard, OpenAPI, token revoke, demo endpoints isolated');

    console.log('\n✨ Merchant API & admin tests passed');
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
