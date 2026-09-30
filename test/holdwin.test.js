const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');

console.log('Testing hold & win mechanic...');
const game = GAMES_CATALOG.wolf_moon_holdwin;

// ------------------------------------------------------------------ 1. base game: coins carry values, 6+ trigger the bonus
{
  const rng = seededRng(3);
  let triggers = 0;
  for (let i = 0; i < 3000; i++) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng });
    const coinCells = r.matrix.flat().filter((s) => s === 'COIN').length;
    assert.strictEqual(Object.keys(r.coins).length, coinCells, 'every coin has a value');
    Object.values(r.coins).forEach((c) => assert(c.v > 0 && !c.special, 'no collector / booster in the base game'));
    assert.strictEqual(!!r.holdwin, coinCells >= game.holdwin.trigger);
    const lines = r.winning_lines.reduce((s, w) => s + w.payout, 0);
    if (!r.max_win_reached) assert.strictEqual(r.total_win, lines + (r.holdwin ? r.holdwin.payout : 0));
    if (r.holdwin) triggers++;
  }
  assert(triggers > 0);
}
console.log('✔ Test 1: coins with values, 6+ coins trigger Hold & Win, win = lines + bonus');

// ------------------------------------------------------------------ 2. bonus rules
{
  const rng = seededRng(11);
  let collectors = 0;
  let boosters = 0;
  for (let i = 0; i < 300; i++) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
    const hw = r.holdwin;
    assert(hw, 'buy starts the bonus');
    assert.strictEqual(Object.keys(hw.start).length, game.holdwin.trigger);
    let left = game.holdwin.respins;
    let count = Object.keys(hw.start).length;
    for (const step of hw.steps) {
      const n = Object.keys(step.landed).length;
      left = n ? game.holdwin.respins : left - 1;
      assert.strictEqual(step.respins_left, left, 'respins reset on every new coin');
      assert(Object.keys(step.grid).length === count + n, 'coins stay locked');
      count += n;
      for (const ev of step.events) {
        if (ev.type === 'collect') collectors++;
        if (ev.type === 'boost') boosters++;
      }
    }
    assert(left === 0 || hw.full, 'bonus ends when respins run out or the grid is full');
    const sum = Math.round(Object.values(hw.grid).reduce((s, c) => s + c.v, 0) * 100) / 100;
    assert.strictEqual(hw.coin_sum_x, sum);
    assert.strictEqual(hw.grand_x > 0, hw.full, 'GRAND only for a full grid');
  }
  assert(collectors > 0 && boosters > 0, 'collector and booster coins appear');
}
console.log('✔ Test 2: respins reset, coins lock, collector / booster, GRAND on full grid');

console.log('All hold & win tests passed.');
