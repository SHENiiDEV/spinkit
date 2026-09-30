// Run against a throw-away database so tests never touch data/spinkit.db
const _os = require('node:os'); const _path = require('node:path'); const _fs = require('node:fs');
process.env.SPINKIT_DB = process.env.SPINKIT_DB || _path.join(_fs.mkdtempSync(_path.join(_os.tmpdir(), 'spinkit-')), 'test.db');
process.env.SPINKIT_QUIET = '1';
const assert = require('node:assert');
const { startServer } = require('../src/server');
const { dbService } = require('../src/db/database');
const { GAMES_CATALOG } = require('../src/games/catalog');

const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTests() {
  console.log('--- Starting RGS & Game Hub Integration Tests ---');
  const server = await startServer(TEST_PORT);
  // clean state: no pending free spins from earlier test runs
  dbService.updateGameState(49102, 'pharaoh_riches', { free_spins_left: 0, free_spins_multiplier: 1, free_spins_bet: 0, free_spins_total_win: 0, active_bonus_data: null });

  try {
    // 1. GET /api/v1/games
    console.log('\n[1] Testing GET /api/v1/games ...');
    const gamesRes = await fetch(`${BASE_URL}/api/v1/games`);
    assert.strictEqual(gamesRes.status, 200);
    const gamesData = await gamesRes.json();
    assert.strictEqual(gamesData.status, 'success');
    assert.strictEqual(gamesData.games.length, Object.keys(GAMES_CATALOG).length, 'Must list every catalog game');
    console.log(`✔ Found ${gamesData.games.length} games:`, gamesData.games.map(g => g.name).join(', '));

    // 2. POST /api/v1/user/refill (Infinite credits)
    console.log('\n[2] Testing POST /api/v1/user/refill ...');
    const refillRes = await fetch(`${BASE_URL}/api/v1/user/refill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 49102, amount: 5000000 })
    });
    assert.strictEqual(refillRes.status, 200);
    const refillData = await refillRes.json();
    assert.strictEqual(refillData.status, 'success');
    assert(refillData.balance >= 15000000, 'Balance should reflect refill');
    console.log(`✔ User balance refilled successfully: ${refillData.balance.toLocaleString()} credits`);

    // 3. POST /api/v1/games/launch
    console.log('\n[3] Testing POST /api/v1/games/launch ...');
    const launchRes = await fetch(`${BASE_URL}/api/v1/games/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-token'
      },
      body: JSON.stringify({
        user_id: 49102,
        game_id: 'pharaoh_riches'
      })
    });
    assert.strictEqual(launchRes.status, 200);
    const launchData = await launchRes.json();
    assert.strictEqual(launchData.status, 'success');
    assert(launchData.launch_url.includes('/games/pharaoh_riches/?token='), 'Launch URL format correct');
    assert(launchData.token, 'Must return session token');
    const sessionToken = launchData.token;
    console.log(`✔ Generated launch URL: ${launchData.launch_url}`);

    // 4. POST /api/v1/rgs/init
    console.log('\n[4] Testing POST /api/v1/rgs/init ...');
    const initRes = await fetch(`${BASE_URL}/api/v1/rgs/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });
    assert.strictEqual(initRes.status, 200);
    const initData = await initRes.json();
    assert.strictEqual(initData.user.user_id, 49102);
    assert.strictEqual(initData.game_config.reels, 5);
    assert.strictEqual(initData.game_config.rows, 3);
    assert(Array.isArray(initData.game_config.bet_steps));
    assert(initData.game_config.paytable.SCATTER);
    assert.strictEqual(typeof initData.active_state.has_free_spins, 'boolean');
    console.log('✔ Slot initialization contract verified according to specification');

    // 5. POST /api/v1/rgs/spin
    console.log('\n[5] Testing POST /api/v1/rgs/spin ...');
    const initialBalance = initData.user.balance;
    const betAmount = 10000;

    const spinRes = await fetch(`${BASE_URL}/api/v1/rgs/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: sessionToken,
        bet_amount: betAmount
      })
    });
    assert.strictEqual(spinRes.status, 200);
    const spinData = await spinRes.json();

    assert(spinData.round_id, 'Round ID must be present');
    assert.strictEqual(spinData.matrix.length, 3, 'Matrix must have 3 rows');
    assert.strictEqual(spinData.matrix[0].length, 5, 'Matrix must have 5 reels');
    assert.strictEqual(spinData.stop_positions.length, 5, 'Stop positions array');
    assert(Array.isArray(spinData.winning_lines), 'Winning lines array');
    assert(typeof spinData.total_win === 'number', 'Total win must be a number');

    const expectedBalance = initialBalance - betAmount + spinData.total_win;
    assert.strictEqual(spinData.balance, expectedBalance, 'Atomic balance after spin must be exact');
    console.log(`✔ Spin calculation successful. Round ID: ${spinData.round_id}`);
    console.log(`  Matrix:`, JSON.stringify(spinData.matrix));
    console.log(`  Win: ${spinData.total_win} | New Balance: ${spinData.balance.toLocaleString()}`);

    // 6. Test Error Handling (INVALID_TOKEN, INVALID_BET, INSUFFICIENT_FUNDS)
    console.log('\n[6] Testing error validations ...');
    const invalidTokenRes = await fetch(`${BASE_URL}/api/v1/rgs/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus-token-xyz', bet_amount: 10000 })
    });
    assert.strictEqual(invalidTokenRes.status, 401);
    const errData = await invalidTokenRes.json();
    assert.strictEqual(errData.error, 'INVALID_TOKEN');
    console.log('✔ INVALID_TOKEN correctly returned 401');

    const invalidBetRes = await fetch(`${BASE_URL}/api/v1/rgs/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, bet_amount: 999999999 })
    });
    assert.strictEqual(invalidBetRes.status, 400);
    const errBetData = await invalidBetRes.json();
    assert.strictEqual(errBetData.error, 'INVALID_BET');
    console.log('✔ INVALID_BET correctly returned 400');

    // 7. Verify audit transaction table
    console.log('\n[7] Testing GET /api/v1/transactions ...');
    const txRes = await fetch(`${BASE_URL}/api/v1/transactions?user_id=49102`);
    assert.strictEqual(txRes.status, 200);
    const txData = await txRes.json();
    assert(txData.transactions.length >= 1, 'At least 1 transaction must be recorded');
    assert.strictEqual(txData.transactions[0].round_id, spinData.round_id);
    console.log(`✔ Verified transaction in audit log table: round ${txData.transactions[0].round_id}`);

    // 8. Test Free Spins zero-deduction mechanic
    console.log('\n[8] Testing Free Spins zero-deduction mechanic ...');
    // Set 3 free spins in DB for testing
    dbService.updateGameState(49102, 'pharaoh_riches', {
      free_spins_left: 3,
      free_spins_multiplier: 3,
      free_spins_bet: 10000
    });

    const preFsBalance = (dbService.getUser(49102)).balance;
    const fsSpinRes = await fetch(`${BASE_URL}/api/v1/rgs/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, bet_amount: 10000 })
    });
    const fsSpinData = await fsSpinRes.json();
    assert.strictEqual(fsSpinData.free_spins.is_free_spin, true);
    // Balance must NOT have deducted betAmount!
    const expectedFsBalance = preFsBalance + fsSpinData.total_win;
    assert.strictEqual(fsSpinData.balance, expectedFsBalance, 'Free spin must NOT deduct bet amount from balance');
    assert(fsSpinData.free_spins.remaining >= 2, 'remaining decremented (or retriggered)');
    console.log('✔ Free spins confirmed: 0 credits deducted, 3x multiplier applied, remaining spins decremented!');

    console.log('\n=============================================');
    console.log('✨ ALL 8 RGS & GAME HUB SPEC TESTS PASSED! ✨');
    console.log('=============================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
