const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');
const megaways = require('../src/engine/mechanics/megaways');

console.log('Testing megaways mechanic...');

// ------------------------------------------------------------------ 1. ways evaluation on reels of different heights
{
  const game = { paytable: { A: { 3: 1, 4: 2 }, B: { 3: 1 } } };
  const cols = [['A', 'B'], ['A', 'A', 'WILD'], ['B', 'A', 'C', 'A'], ['C', 'C'], ['A']];
  const wins = megaways.evaluate(game, cols, 100, 3);
  const a = wins.find((w) => w.symbol === 'A');
  // reel1: 1 A, reel2: 2 A + 1 WILD = 3, reel3: 2 A -> 3 reels, 1*3*2 = 6 ways
  assert.strictEqual(a.count, 3);
  assert.strictEqual(a.ways, 6);
  assert.strictEqual(a.payout, Math.floor(100 * 1 * 6) * 3, 'payout x win multiplier');
  const b = wins.find((w) => w.symbol === 'B');
  // reel1: 1 B, reel2: WILD only (1), reel3: 1 B -> 1 way
  assert.strictEqual(b.ways, 1);
}
console.log('✔ Test 1: ways = product of matching symbols per reel, WILD substitutes');

// ------------------------------------------------------------------ 2. game shapes and multiplier progression
{
  const game = GAMES_CATALOG.jaguar_temple_megaways;
  const rng = seededRng(5);
  let sawCascade = false;
  for (let i = 0; i < 400; i++) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng });
    assert.strictEqual(r.reels.length, 6);
    r.reels.forEach((col, c) => {
      assert(col.length >= 2 && col.length <= 7, 'reel height 2..7');
      assert.strictEqual(col.length, r.heights[c]);
      if (c === 0 || c === 5) assert(!col.includes('WILD'), 'no wild on reels 1 and 6');
    });
    assert.strictEqual(r.ways, r.heights.reduce((a, b) => a * b, 1));
    const winning = r.cascades.filter((s) => s.wins.length);
    winning.forEach((s, k) => assert.strictEqual(s.win_multiplier, 1 + k, 'base multiplier x1, +1 per cascade'));
    if (winning.length > 1) sawCascade = true;
    // heights never change during cascades
    r.cascades.forEach((s) => s.reels.forEach((col, c) => assert.strictEqual(col.length, r.heights[c])));
  }
  assert(sawCascade);
  assert.strictEqual(game.ways_count, 117649);
}
console.log('✔ Test 2: 2..7 rows per reel, up to 117,649 ways, multiplier +1 per cascade');

// ------------------------------------------------------------------ 3. free spins: multiplier never resets
{
  const game = GAMES_CATALOG.jaguar_temple_megaways;
  const rng = seededRng(77);
  const base = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
  assert(base.free_spins.remaining >= 12);
  assert.strictEqual(base.bonus.win_multiplier, 1, 'feature starts at x1');
  const state = { free_spins_left: base.free_spins.remaining, free_spins_bet: base.bet, free_spins_total_win: 0, active_bonus_data: base.bonus };
  let prev = 1;
  let grew = false;
  while (state.free_spins_left > 0) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, activeState: state });
    assert.strictEqual(r.win_multiplier.start, prev, 'carries over from the previous free spin');
    assert(r.win_multiplier.end >= r.win_multiplier.start);
    if (r.win_multiplier.end > r.win_multiplier.start) grew = true;
    prev = r.win_multiplier.end;
    state.free_spins_left = r.free_spins.remaining;
    state.active_bonus_data = r.bonus;
    if (r.max_win_reached) break;
  }
  assert(grew);
}
console.log('✔ Test 3: free spins win multiplier keeps growing across spins');

console.log('All megaways tests passed.');
