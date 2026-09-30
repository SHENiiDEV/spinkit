const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');
const matchlines = require('../src/engine/mechanics/matchlines');

console.log('Testing match lines mechanic...');

// ------------------------------------------------------------------ 1. lines in rows and columns, WILD substitutes
{
  const game = { paytable: { A: { 3: 1, 4: 2 }, B: { 3: 1 } }, min_line: 3 };
  const grid = [
    ['A', 'A', 'WILD', 'A', 'B'],
    ['B', 'C', 'B', 'C', 'B'],
    ['B', 'C', 'A', 'C', 'B'],
    ['C', 'A', 'C', 'A', 'C']
  ];
  const lines = matchlines.findLines(game, grid);
  const h = lines.find((l) => l.symbol === 'A' && l.dir === 'h');
  assert.strictEqual(h.positions.length, 4, 'A A WILD A = line of 4');
  const v = lines.find((l) => l.symbol === 'B' && l.dir === 'v');
  assert.deepStrictEqual(v.positions, [[0, 4], [1, 4], [2, 4]], 'vertical B line');
  assert(!lines.find((l) => l.symbol === 'B' && l.dir === 'h'), 'B C B is not a line');
  // the WILD also joins a vertical line of A? column 2: WILD, B, A -> no
  assert.strictEqual(lines.filter((l) => l.symbol === 'A').length, 1);
}
console.log('✔ Test 1: 3+ in a row or column, WILD substitutes');

// ------------------------------------------------------------------ 2. multiplier: base +1 per cascade, resets every spin
{
  const game = GAMES_CATALOG.gold_rush_canyon;
  assert.strictEqual(game.reels_count, 7);
  assert.strictEqual(game.rows_count, 8);
  const rng = seededRng(21);
  let longest = 0;
  for (let i = 0; i < 600; i++) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng });
    assert.strictEqual(r.matrix.length, 8);
    assert.strictEqual(r.matrix[0].length, 7);
    const winning = r.cascades.filter((c) => c.wins.length);
    winning.forEach((c, k) => {
      assert.strictEqual(c.win_multiplier, 1 + k, 'base: x1, x2, x3 …');
      c.wins.forEach((w) => assert.strictEqual(w.payout, Math.floor(game.default_bet * w.multiplier * c.win_multiplier)));
    });
    longest = Math.max(longest, winning.length);
  }
  assert(longest >= 3, 'cascades happen');
}
console.log('✔ Test 2: base multiplier x1 → +1 per cascade, resets each spin');

// ------------------------------------------------------------------ 3. free spins: even multipliers kept for the whole feature
{
  const game = GAMES_CATALOG.gold_rush_canyon;
  const rng = seededRng(8);
  const base = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
  assert(base.free_spins.remaining >= 10);
  assert.strictEqual(base.bonus.multiplier, 2, 'free spins start at x2');
  const state = { free_spins_left: base.free_spins.remaining, free_spins_bet: base.bet, free_spins_total_win: 0, active_bonus_data: base.bonus };
  let prev = 2;
  let grew = false;
  while (state.free_spins_left > 0) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, activeState: state });
    assert.strictEqual(r.win_multiplier.start, prev);
    r.cascades.filter((c) => c.wins.length).forEach((c, k) => {
      assert.strictEqual(c.win_multiplier % 2, 0, 'only even multipliers in free spins');
      assert.strictEqual(c.win_multiplier, Math.min(1024, prev + 2 * k));
    });
    if (r.win_multiplier.end > prev) grew = true;
    prev = r.win_multiplier.end;
    state.free_spins_left = r.free_spins.remaining;
    state.active_bonus_data = r.bonus;
    if (r.max_win_reached) break;
  }
  assert(grew);
}
console.log('✔ Test 3: free spins x2, x4, x6 … never reset until the end');

console.log('All match lines tests passed.');
