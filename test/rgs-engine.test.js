const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');
const ways = require('../src/engine/mechanics/ways');
const tumble = require('../src/engine/mechanics/tumble');

console.log('Testing RGS Engine...');

// ------------------------------------------------------------------ 1. every game spins
for (const game of Object.values(GAMES_CATALOG)) {
  if (game.kind === 'exclusive') continue; // stateful round games: test/exclusive.test.js
  const rng = seededRng(42);
  for (let i = 0; i < 300; i++) {
    const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng });
    assert(r.round_id);
    assert.strictEqual(r.matrix.length, game.rows_count, `${game.id}: rows`);
    assert.strictEqual(r.matrix[0].length, game.reels_count, `${game.id}: reels`);
    assert(Number.isInteger(r.total_win) && r.total_win >= 0, `${game.id}: integer win`);
    const sum = r.winning_lines.reduce((s, w) => s + w.payout, 0) + (r.scatter_win ? r.scatter_win.payout : 0) + (r.holdwin ? r.holdwin.payout : 0);
    if (game.mechanic !== 'tumble') assert.strictEqual(r.total_win, sum, `${game.id}: win = sum of parts`);
  }
  assert(game.bet_steps.includes(game.default_bet), `${game.id}: default bet on ladder`);
}
console.log('✔ Test 1: all games spin, shapes and win sums are consistent');

// ------------------------------------------------------------------ 2. line evaluation
const pharaoh = GAMES_CATALOG.pharaoh_riches;
const bet = 2000; // line bet = 100
const m = [
  ['K', 'WILD', 'A', '10', 'Q'],
  ['SCATTER', 'A', 'A', 'A', 'K'],
  ['10', 'K', 'SCATTER', 'J', 'SCATTER']
];
const lw = RgsEngine.evaluatePaylines(pharaoh, m, bet);
const top = lw.find((w) => w.line_index === 1); // middle line: SCATTER A A A K -> no win (starts with scatter)
assert(!top, 'line starting with SCATTER must not pay');
const sc = RgsEngine.evaluateScatters(pharaoh, m, bet);
assert.strictEqual(sc.count, 3);
assert.strictEqual(sc.payout, Math.floor(bet * pharaoh.paytable.SCATTER[3]));
assert.strictEqual(sc.free_spins_awarded, 10);

const m2 = [
  ['WILD', 'WILD', 'A', 'K', 'Q'],
  ['A', 'A', 'A', 'A', 'J'],
  ['Q', 'K', 'J', '10', 'K']
];
const lw2 = RgsEngine.evaluatePaylines(pharaoh, m2, bet);
const mid = lw2.find((w) => w.line_index === 1);
assert.strictEqual(mid.symbol, 'A');
assert.strictEqual(mid.count, 4);
assert.strictEqual(mid.payout, Math.floor(100 * pharaoh.paytable.A[4]));
const topLine = lw2.find((w) => w.line_index === 2); // WILD WILD A K Q -> 3x A (wilds substitute)
assert.strictEqual(topLine.symbol, 'A');
assert.strictEqual(topLine.count, 3);
console.log('✔ Test 2: paylines pay per LINE bet, wilds substitute, scatters pay anywhere');

// ------------------------------------------------------------------ 3. ways evaluation
const cyber = GAMES_CATALOG.cyber_neon;
const wm = [
  ['A', 'A', 'WILD', 'K', 'Q'],
  ['J', 'A', 'A', 'J', 'K'],
  ['Q', 'K', 'J', 'A', 'J']
];
const ww = ways.evaluate(cyber, wm, 2000);
const aWin = ww.find((w) => w.symbol === 'A');
assert.strictEqual(aWin.count, 4, 'A on reels 1-4');
assert.strictEqual(aWin.ways, 1 * 2 * 2 * 1, 'ways = product of matches per reel');
assert.strictEqual(aWin.payout, Math.floor((2000 / 20) * cyber.paytable.A[4] * 4));
const ww2 = ways.evaluate(cyber, wm, 2000, { '0,2': 3 });
assert.strictEqual(ww2.find((w) => w.symbol === 'A').ways, 1 * 2 * 4 * 1, 'x3 wild counts three times');
console.log('✔ Test 3: ways count & wild multipliers');

// ------------------------------------------------------------------ 4. tumble
const olympus = GAMES_CATALOG.olympus_thunder;
const grid = [
  ['CROWN', 'CROWN', 'BLUE', 'RED', 'RING', 'M10'],
  ['CROWN', 'BLUE', 'CROWN', 'RED', 'RING', 'GREEN'],
  ['CROWN', 'CROWN', 'BLUE', 'PURPLE', 'YELLOW', 'GREEN'],
  ['CROWN', 'BLUE', 'CROWN', 'PURPLE', 'YELLOW', 'SCATTER'],
  ['RED', 'RED', 'BLUE', 'PURPLE', 'HOURGLASS', 'GREEN']
];
const tw = tumble.evaluateGrid(olympus, grid, 2000);
const crown = tw.find((w) => w.symbol === 'CROWN');
assert.strictEqual(crown.count, 8);
assert.strictEqual(crown.payout, Math.floor(2000 * olympus.paytable.CROWN[8]));
assert(!tw.find((w) => w.symbol === 'BLUE'), '6 blue do not pay');
let sawCascade = false;
let sawMult = false;
const rng = seededRng(7);
for (let i = 0; i < 3000; i++) {
  const r = RgsEngine.calculateSpin({ game: olympus, betAmount: 200, rng });
  assert(r.cascades.length >= 1);
  const last = r.cascades[r.cascades.length - 1];
  assert.strictEqual(last.wins.length, 0, 'sequence ends without wins');
  assert.deepStrictEqual(last.grid, r.final_matrix);
  if (r.cascades.length > 2) sawCascade = true;
  if (r.multipliers.applied > 1) {
    sawMult = true;
    const tumbleWin = r.cascades.reduce((s, c) => s + c.win, 0);
    const scatterPay = r.scatter_win ? r.scatter_win.payout : 0;
    assert.strictEqual(r.total_win, Math.min(tumbleWin * r.multipliers.applied + scatterPay, olympus.max_win_x * 200));
  }
}
assert(sawCascade && sawMult, 'tumbles and multipliers occur');
console.log('✔ Test 4: tumble clusters, cascades and multipliers');

// ------------------------------------------------------------------ 5. free spins state, buy, cap
const fsSpin = RgsEngine.calculateSpin({
  game: pharaoh,
  betAmount: 2000,
  activeState: { free_spins_left: 5, free_spins_bet: 2000, free_spins_total_win: 0 }
});
assert.strictEqual(fsSpin.is_free_spin, true);
assert.strictEqual(fsSpin.free_spins.multiplier, 3);
assert(fsSpin.free_spins.remaining >= 4);

for (const game of Object.values(GAMES_CATALOG).filter((g) => g.free_spins && g.free_spins.buy)) {
  const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, buyFeature: true, rng: seededRng(3) });
  if (game.mechanic === 'holdwin') assert(r.holdwin, `${game.id}: buy always triggers Hold & Win`);
  else assert(r.free_spins.remaining > 0, `${game.id}: buy always triggers free spins`);
}

const capped = RgsEngine.calculateSpin({
  game: olympus,
  betAmount: 200,
  rng: seededRng(11),
  activeState: { free_spins_left: 3, free_spins_bet: 200, free_spins_total_win: olympus.max_win_x * 200 - 1 }
});
assert(capped.total_win <= 1, 'max win cap respected');
console.log('✔ Test 5: free spins, feature buy and max-win cap');

// ------------------------------------------------------------------ 6. RTP sanity (quick, loose bounds)
for (const id of ['pharaoh_riches', 'vegas_fruits', 'jade_dragon']) {
  const game = GAMES_CATALOG[id];
  const r = seededRng(99);
  let paid = 0;
  let won = 0;
  for (let i = 0; i < 60000; i++) {
    const s = RgsEngine.calculateSpin({ game, betAmount: 100, rng: r });
    paid += 100;
    won += s.total_win;
    let st = s.free_spins.remaining ? { free_spins_left: s.free_spins.remaining, free_spins_bet: 100, free_spins_total_win: 0 } : null;
    while (st && st.free_spins_left > 0) {
      const f = RgsEngine.calculateSpin({ game, betAmount: 100, rng: r, activeState: st });
      won += f.total_win;
      st.free_spins_total_win += f.total_win;
      st.free_spins_left = f.free_spins.remaining;
    }
  }
  const rtp = won / paid;
  assert(rtp > 0.85 && rtp < 1.07, `${id}: RTP ${rtp} within sane bounds`);
  console.log(`  ${id}: quick-sim RTP ${(rtp * 100).toFixed(1)}%`);
}
console.log('✔ Test 6: RTP sanity');

// ------------------------------------------------------------------ 7. skins share their template's math exactly
const skins = Object.values(GAMES_CATALOG).filter((g) => g.skin_of);
assert(skins.length >= 90, 'skin catalogue loaded');
const outcome = (game) => {
  const r = seededRng(21);
  const out = [];
  for (let i = 0; i < 400; i++) out.push(RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng: r }).total_win);
  return out.join(',');
};
const baseOutcomes = {};
for (const g of skins.filter((_, i) => i % 7 === 0)) {
  baseOutcomes[g.skin_of] = baseOutcomes[g.skin_of] || outcome(GAMES_CATALOG[g.skin_of]);
  assert.strictEqual(outcome(g), baseOutcomes[g.skin_of], `${g.id} must pay exactly like ${g.skin_of}`);
  assert.strictEqual(g.rtp, GAMES_CATALOG[g.skin_of].rtp);
  for (const sym of Object.values(g.symbols)) assert(sym.kind, `${g.id}:${sym.id} has art`);
}
console.log(`✔ Test 7: ${skins.length} skins, sampled ones pay identically to their templates`);

console.log('\nAll RGS Engine tests passed successfully!');
