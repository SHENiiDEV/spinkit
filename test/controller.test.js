// Run against a throw-away database so tests never touch data/spinkit.db
const _os = require('node:os'); const _path = require('node:path'); const _fs = require('node:fs');
process.env.SPINKIT_DB = process.env.SPINKIT_DB || _path.join(_fs.mkdtempSync(_path.join(_os.tmpdir(), 'spinkit-')), 'test.db');
process.env.SPINKIT_QUIET = '1';
const assert = require('node:assert');
const { HubController } = require('../src/api/hub-controller');
const { RgsController } = require('../src/api/rgs-controller');
const { dbService } = require('../src/db/database');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { RgsEngine } = require('../src/engine/rgs');

console.log('--- Testing RGS & Hub Controllers & Endpoints Directly ---');

// Reset test user state for clean run
dbService.updateGameState(49102, 'pharaoh_riches', {
  free_spins_left: 0,
  free_spins_multiplier: 1,
  free_spins_bet: 0,
  free_spins_total_win: 0,
  active_bonus_data: null
});

// 1. Test GET /api/v1/games
console.log('\n[1] Testing HubController.handleGetGames() ...');
const gamesResult = HubController.handleGetGames();
assert.strictEqual(gamesResult.status, 200);
assert.strictEqual(gamesResult.body.status, 'success');
assert.strictEqual(gamesResult.body.games.length, Object.keys(GAMES_CATALOG).length, 'Must return every catalog game');
console.log(`✔ Found ${gamesResult.body.games.length} games: ${gamesResult.body.games.map(g => g.name).join(', ')}`);

// 2. Test POST /api/v1/user/refill
console.log('\n[2] Testing HubController.handleRefill() ...');
const refillResult = HubController.handleRefill({ user_id: 49102, amount: 5000000 });
assert.strictEqual(refillResult.status, 200);
assert.strictEqual(refillResult.body.status, 'success');
assert(refillResult.body.balance >= 15000000);
console.log(`✔ Balance refilled: ${refillResult.body.balance.toLocaleString()} credits`);

// 3. Test POST /api/v1/games/launch
console.log('\n[3] Testing HubController.handleLaunch() ...');
const launchResult = HubController.handleLaunch({
  user_id: 49102,
  game_id: 'pharaoh_riches'
}, 'localhost:3000');

assert.strictEqual(launchResult.status, 200);
assert.strictEqual(launchResult.body.status, 'success');
assert(launchResult.body.launch_url.includes('/games/pharaoh_riches/?token='));
assert(launchResult.body.token);
const token = launchResult.body.token;
console.log(`✔ Generated launch URL: ${launchResult.body.launch_url}`);
console.log(`✔ Session token: ${token}`);

// 4. Test POST /api/v1/rgs/init
console.log('\n[4] Testing RgsController.handleInit() ...');
const initResult = RgsController.handleInit({ token });
assert.strictEqual(initResult.status, 200);
assert.strictEqual(initResult.body.user.user_id, 49102);
assert.strictEqual(initResult.body.game_config.reels, 5);
assert.strictEqual(initResult.body.game_config.rows, 3);
assert.strictEqual(initResult.body.game_config.paylines_count, 20);
assert(Array.isArray(initResult.body.game_config.bet_steps));
assert(initResult.body.game_config.paytable.SCATTER);
assert.strictEqual(typeof initResult.body.active_state.has_free_spins, 'boolean');
console.log('✔ Init payload matches Section 4.2 specification:');
console.log(JSON.stringify(initResult.body, null, 2));

// 5. Test POST /api/v1/rgs/spin
console.log('\n[5] Testing RgsController.handleSpin() ...');
const preSpinBalance = initResult.body.user.balance;
const bet = 10000;
const spinResult = RgsController.handleSpin({
  token,
  bet_amount: bet
});

assert.strictEqual(spinResult.status, 200);
const spin = spinResult.body;
assert(spin.round_id, 'round_id generated');
assert.strictEqual(spin.matrix.length, 3, 'matrix has 3 rows');
assert.strictEqual(spin.matrix[0].length, 5, 'each row has 5 columns');
assert.strictEqual(spin.stop_positions.length, 5, '5 stop positions');
assert(Array.isArray(spin.winning_lines));
assert(typeof spin.total_win === 'number');

const expectedBalance = preSpinBalance - bet + spin.total_win;
assert.strictEqual(spin.balance, expectedBalance, 'Atomic balance after spin must match exactly');
console.log('✔ Spin payload matches Section 4.3 specification:');
console.log(`  Round ID: ${spin.round_id}`);
console.log(`  Matrix:`, spin.matrix);
console.log(`  Winning Lines count: ${spin.winning_lines.length}`);
console.log(`  Total Win: ${spin.total_win} | New Balance: ${spin.balance.toLocaleString()}`);

// 6. Test Error Handling
console.log('\n[6] Testing Error Scenarios ...');
// Invalid token
const invalidTokenRes = RgsController.handleSpin({ token: 'nonexistent-token', bet_amount: 10000 });
assert.strictEqual(invalidTokenRes.status, 401);
assert.strictEqual(invalidTokenRes.body.error, 'INVALID_TOKEN');

// Invalid bet step (the spin above may have triggered free spins, where the bet is fixed — clear them)
dbService.db.prepare('UPDATE game_states SET free_spins_left = 0').run();
const invalidBetRes = RgsController.handleSpin({ token, bet_amount: 12345 });
assert.strictEqual(invalidBetRes.status, 400);
assert.strictEqual(invalidBetRes.body.error, 'INVALID_BET');

// Insufficient funds
dbService.updateBalance(49102, 100);
const brokeRes = RgsController.handleSpin({ token, bet_amount: 10000 });
assert.strictEqual(brokeRes.status, 400);
assert.strictEqual(brokeRes.body.error, 'INSUFFICIENT_FUNDS');
// Restore balance
dbService.updateBalance(49102, 10000000);
console.log('✔ INVALID_TOKEN, INVALID_BET, and INSUFFICIENT_FUNDS returned correct error codes.');

// 7. Test Free Spins State & Zero-Deduction Mechanics
console.log('\n[7] Testing Free Spins State & Zero-Deduction ...');
dbService.updateGameState(49102, 'pharaoh_riches', {
  free_spins_left: 5,
  free_spins_multiplier: 3,
  free_spins_bet: 10000,
  free_spins_total_win: 0
});

const userBeforeFs = dbService.getUser(49102).balance;
const fsSpinRes = RgsController.handleSpin({ token, bet_amount: 10000 });
assert.strictEqual(fsSpinRes.status, 200);
assert.strictEqual(fsSpinRes.body.free_spins.is_free_spin, true);
assert(fsSpinRes.body.free_spins.remaining >= 4, 'remaining decremented (or retriggered)');
assert.strictEqual(fsSpinRes.body.free_spins.multiplier, 3);
// Zero bet deducted! Balance = userBeforeFs + total_win
assert.strictEqual(fsSpinRes.body.balance, userBeforeFs + fsSpinRes.body.total_win);
console.log(`✔ Free spin verified: 0 bet deducted, 3x multiplier applied, remaining: ${fsSpinRes.body.free_spins.remaining}`);

// 8. Test Transactions History Audit
console.log('\n[8] Testing Audit Transactions Log ...');
const txResult = HubController.handleGetTransactions(49102, 10);
assert.strictEqual(txResult.status, 200);
assert(txResult.body.transactions.length >= 2);
assert.strictEqual(txResult.body.transactions[0].round_id, fsSpinRes.body.round_id);
console.log(`✔ Audit log retrieved ${txResult.body.transactions.length} rounds. Latest: ${txResult.body.transactions[0].round_id}`);

console.log('\n======================================================');
console.log('🎉 ALL RGS & HUB SPECIFICATION CONTRACT TESTS PASSED! 🎉');
console.log('======================================================\n');
