const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');
const clusters = require('../src/engine/mechanics/clusters');

console.log('Testing clusters mechanic...');

// ------------------------------------------------------------------ 1. cluster detection (orthogonal only)
{
  const game = { paytable: { A: { 5: 1 }, B: { 5: 1 } }, min_cluster: 5 };
  const grid = [
    ['A', 'A', 'B', 'B'],
    ['A', 'B', 'B', 'A'],
    ['A', 'A', 'B', 'A'],
    ['B', 'A', 'SCATTER', 'A']
  ];
  const found = clusters.findClusters(game, grid);
  const a = found.find((f) => f.symbol === 'A');
  const b = found.find((f) => f.symbol === 'B');
  assert.strictEqual(a.positions.length, 6, 'A cluster: 6 connected cells (diagonals do not count)');
  assert.strictEqual(b.positions.length, 5);
  assert.strictEqual(found.length, 2, 'the 3-cell A group on the right is too small');
}
console.log('✔ Test 1: clusters are 5+ orthogonally connected symbols');

// ------------------------------------------------------------------ 2. spot progression
{
  const seq = [];
  let v = 0;
  for (let i = 0; i < 14; i++) { v = clusters.hitSpot(v, 1024); seq.push(v); }
  assert.deepStrictEqual(seq, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 1024, 1024, 1024]);
}
console.log('✔ Test 2: spots: marked -> x2 -> doubling up to x1024');

// ------------------------------------------------------------------ 3. spot multipliers apply to later tumbles
{
  // one-symbol grid: every tumble is a full 3x3 cluster, so spots grow every step
  const game = {
    mechanic: 'clusters', reels_count: 3, rows_count: 3, min_cluster: 5, bet_multiplier: 20,
    paytable: { A: { 5: 1, 9: 2 } }, symbol_weights: { A: 1 }, spots: { max: 8 }, free_spins: { trigger: 3, spins: 10, sticky_spots: true }
  };
  const r = clusters.play(game, { bet: 100, rng: seededRng(1) });
  const steps = r.cascades.filter((c) => c.wins.length);
  assert(steps.length > 5);
  assert.strictEqual(steps[0].wins[0].spot_multiplier, 1, 'first hit only marks the cells');
  assert.strictEqual(steps[0].wins[0].payout, 200);
  assert.strictEqual(steps[1].wins[0].spot_multiplier, 1, 'marked cells are not multipliers yet');
  assert.strictEqual(steps[2].wins[0].spot_multiplier, 9 * 2, 'nine x2 spots under the cluster add up');
  assert.strictEqual(steps[2].wins[0].payout, 100 * 2 * 18);
  assert.strictEqual(steps[3].wins[0].spot_multiplier, 9 * 4);
  assert.strictEqual(steps[5].wins[0].spot_multiplier, 9 * 8, 'capped at spots.max');
  assert.deepStrictEqual(r.bonus, { spots: {} }, 'base game spots do not carry over');
}
console.log('✔ Test 3: cluster wins are multiplied by the sum of spots under them');

// ------------------------------------------------------------------ 4. sticky spots in free spins
{
  const game = GAMES_CATALOG.sweet_spot_mania;
  assert.strictEqual(game.mechanic, 'clusters');
  const rng = seededRng(99);
  const base = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
  assert(base.free_spins.remaining >= 10, 'buy triggers free spins');
  assert.deepStrictEqual(base.bonus.spots || {}, {}, 'feature starts clean');
  const state = { free_spins_left: base.free_spins.remaining, free_spins_bet: base.bet, free_spins_total_win: 0, active_bonus_data: base.bonus };
  let prev = {};
  let grew = false;
  while (state.free_spins_left > 0) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, activeState: state });
    for (const [k, v] of Object.entries(prev)) assert((r.spots[k] || 0) >= v, 'spots never shrink during the feature');
    if (Object.keys(r.spots).length > Object.keys(prev).length) grew = true;
    prev = r.spots;
    state.free_spins_left = r.free_spins.remaining;
    state.active_bonus_data = r.bonus;
    const sum = r.winning_lines.reduce((s, w) => s + w.payout, 0) + (r.scatter_win ? r.scatter_win.payout : 0);
    if (!r.max_win_reached) assert.strictEqual(r.total_win, sum);
  }
  assert(grew, 'spots accumulate across free spins');
}
console.log('✔ Test 4: Sweet Spot Mania — spots stay for the whole free spins round');

console.log('All clusters tests passed.');
