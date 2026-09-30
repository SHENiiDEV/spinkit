const assert = require('node:assert');
const { RgsEngine } = require('../src/engine/rgs');
const { GAMES_CATALOG } = require('../src/games/catalog');
const { seededRng } = require('../src/engine/rng');
const giants = require('../src/engine/mechanics/giants');

console.log('Testing giants mechanic...');

/** rng stub: int() returns the queued values in order (then 0). */
const scripted = (values) => ({ int: () => (values.length ? values.shift() : 0), float: () => 0 });

// A tiny 3x3 test game: strips are written by hand, G = 3-row giant.
const strip = (list) => ({ syms: list.map((x) => x[0]), parts: list.map((x) => x[1]) });
const G = (sym) => [[sym, 0], [sym, 1], [sym, 2]];
const n = (sym) => [sym, -1];
function testGame(strips, fs = {}) {
  return {
    id: 'giants_test',
    mechanic: 'giants',
    reels_count: 3,
    rows_count: 3,
    bet_multiplier: 20,
    giants: { BIG: { height: 3 }, WILD: { height: 3 } },
    paytable: { BIG: { 3: 10 }, A: { 3: 2 }, B: { 3: 1 }, SCATTER: { 3: 2 } },
    reel_strips: strips,
    fs_reel_strips: strips,
    free_spins: { trigger: 3, spins: 5, sticky_giants: true, sticky_multipliers: { 2: 1, 3: 1 }, ...fs },
    max_win_x: 5000
  };
}

// ------------------------------------------------------------------ 1. a full giant counts as ONE symbol
{
  const strips = [
    strip([...G('BIG'), n('A'), n('B')]),
    strip([n('A'), n('A'), n('B'), n('B'), n('B')]),
    strip([n('A'), n('B'), n('B'), n('B'), n('B')])
  ];
  const game = testGame(strips);
  // stops: reel0 = 0 (giant fully visible), reel1 = 0 (A,A,B), reel2 = 0 (A,B,B)
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0]) });
  assert.deepStrictEqual(r.matrix.map((row) => row[0]), ['BIG', 'BIG', 'BIG']);
  assert.strictEqual(r.giants.length, 1);
  assert.strictEqual(r.giants[0].full, true);
  assert.strictEqual(r.giants[0].multiplier, 1);
  assert.strictEqual(r.giants[0].sticky, false, 'no sticky in the base game');
  // BIG only on reel 0 -> no BIG win; A: reel0 has no A -> nothing; B: no B on reel0 -> nothing
  assert.strictEqual(r.win, 0);
  assert.deepStrictEqual(r.bonus.sticky, []);
}
console.log('✔ Test 1: giant detection, full flag, no sticky in base game');

// ------------------------------------------------------------------ 2. WILD giant substitutes, ways not multiplied by height
{
  const strips = [
    strip([n('A'), n('A'), n('B'), n('B')]),
    strip([...G('WILD'), n('B'), n('B')]),
    strip([n('A'), n('B'), n('B'), n('B')])
  ];
  const game = testGame(strips);
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0]) });
  // A: reel0 2 A, reel1 WILD giant = 1 object, reel2 1 A -> 2 ways * 2 * coin(100) = 400
  const a = r.winning_lines.find((w) => w.symbol === 'A');
  assert(a, 'A pays through the wild giant');
  assert.strictEqual(a.ways, 2);
  assert.strictEqual(a.payout, 400);
  // B: reel0 1 B, reel1 WILD (1), reel2 2 B -> 2 ways * 1 * 100 = 200
  const b = r.winning_lines.find((w) => w.symbol === 'B');
  assert.strictEqual(b.ways, 2);
  assert.strictEqual(b.payout, 200);
  assert.strictEqual(r.win, 600);
}
console.log('✔ Test 2: wild giant substitutes and counts as one way');

// ------------------------------------------------------------------ 3. free spins: full giant sticks with multiplier, partial does not
{
  const strips = [
    strip([n('A'), n('A'), n('A'), n('B')]),
    strip([...G('BIG'), n('A'), n('B')]),
    strip([n('A'), n('B'), ...G('WILD'), n('B')])
  ];
  const game = testGame(strips);
  // reel1 stop 0 -> BIG fully visible; reel2 stop 0 -> A, B, WILD part 0 (partial giant)
  // int() calls: 3 stops, then the sticky multiplier pick (weights 1:1, roll 1 -> x3)
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0, 1]), inFreeSpins: true, bonus: {} });
  const big = r.giants.find((g) => g.symbol === 'BIG');
  const wild = r.giants.find((g) => g.symbol === 'WILD');
  assert.strictEqual(big.full, true);
  assert.strictEqual(big.sticky, true);
  assert.strictEqual(big.new_sticky, true);
  assert.strictEqual(big.multiplier, 3);
  assert.strictEqual(wild.full, false, 'giant cut by the window edge');
  assert.strictEqual(wild.sticky, false);
  assert.strictEqual(r.bonus.sticky.length, 1);
  assert.deepStrictEqual(r.bonus.sticky[0], { reel: 1, top: 0, height: 3, symbol: 'BIG', multiplier: 3 });
  // A: reel0 3 A x reel1 BIG? no -> BIG is not A, no wild on reel1 -> no A win
  assert(!r.winning_lines.find((w) => w.symbol === 'A'));

  // next free spin: the sticky giant stays and multiplies ways
  const r2 = giants.play(game, { bet: 2000, rng: scripted([0, 3, 0]), inFreeSpins: true, bonus: r.bonus });
  assert.deepStrictEqual(r2.matrix.map((row) => row[1]), ['BIG', 'BIG', 'BIG'], 'sticky giant overwrites reel 1');
  const kept = r2.giants.find((g) => g.symbol === 'BIG');
  assert.strictEqual(kept.sticky, true);
  assert.strictEqual(kept.new_sticky, false);
  assert.strictEqual(r2.bonus.sticky.length, 1);
}
console.log('✔ Test 3: sticky giants in free spins (full only) with random multiplier');

// ------------------------------------------------------------------ 4. multiplier giant multiplies the ways
{
  const strips = [
    strip([n('A'), n('A'), n('B'), n('B')]),
    strip([n('B'), n('B'), n('B'), n('B')]),
    strip([n('A'), n('B'), n('B'), n('B')])
  ];
  const game = testGame(strips);
  const bonus = { sticky: [{ reel: 1, top: 0, height: 3, symbol: 'WILD', multiplier: 2 }] };
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0]), inFreeSpins: true, bonus });
  const a = r.winning_lines.find((w) => w.symbol === 'A');
  // 2 A x (WILD x2) x 1 A = 4 ways -> 4 * 2 * 100 = 800
  assert.strictEqual(a.ways, 4);
  assert.strictEqual(a.payout, 800);
  assert.deepStrictEqual(a.giant_multipliers, [{ reel: 1, top: 0, multiplier: 2 }]);
}
console.log('✔ Test 4: giant multipliers multiply the ways');

// ------------------------------------------------------------------ 5. Enchanted Knight catalog game end-to-end
{
  const game = GAMES_CATALOG.enchanted_knight;
  assert.strictEqual(game.mechanic, 'giants');
  assert.strictEqual(game.reels_count, 5);
  assert.strictEqual(game.rows_count, 5);
  assert.strictEqual(game.ways_count, 3125);
  // strips: giants are whole 3-row blocks, no knight on reel 1
  game.reel_strips.forEach((s, c) => {
    for (let i = 0; i < s.syms.length; i++) {
      if (s.parts[i] === 0) assert.deepStrictEqual([s.syms[i + 1], s.syms[i + 2], s.parts[i + 1], s.parts[i + 2]], [s.syms[i], s.syms[i], 1, 2]);
    }
    if (c === 0) assert(!s.syms.includes('WILD'), 'no wild on reel 1');
  });
  const rng = seededRng(7);
  let sawSticky = false;
  for (let round = 0; round < 40; round++) {
    const base = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
    assert(base.free_spins.remaining > 0, 'buy triggers free spins');
    const state = { free_spins_left: base.free_spins.remaining, free_spins_bet: base.bet, free_spins_total_win: 0, active_bonus_data: base.bonus };
    let prevSticky = 0;
    while (state.free_spins_left > 0) {
      const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, activeState: state });
      const sticky = (r.giants || []).filter((g) => g.sticky);
      assert(sticky.length >= Math.min(prevSticky, sticky.length));
      sticky.forEach((g) => {
        assert(g.full);
        const allowed = giants.stickyValues(game.free_spins.sticky_multipliers, g.symbol);
        assert(allowed.includes(g.multiplier), `${g.symbol} multiplier x${g.multiplier} is in its table`);
        if (g.symbol === 'PRINCESS') assert([2, 3].includes(g.multiplier));
        if (g.symbol === 'WILD') assert(g.multiplier >= 1 && g.multiplier <= 500);
      });
      if (sticky.length) sawSticky = true;
      if (r.free_spins.remaining > 0) assert.strictEqual(r.bonus.sticky.length, sticky.length);
      prevSticky = sticky.length;
      state.free_spins_left = r.free_spins.remaining;
      state.free_spins_total_win += r.total_win;
      state.active_bonus_data = r.bonus;
    }
  }
  assert(sawSticky, 'sticky giants appear in bought free spins');
}
console.log('✔ Test 5: Enchanted Knight strips, bought free spins, sticky multipliers from the tables');

// ------------------------------------------------------------------ 6. per-symbol multiplier tables
{
  const strips = [
    strip([n('A'), n('A'), n('A'), n('B')]),
    strip([...G('BIG'), n('A'), n('B')]),
    strip([...G('WILD'), n('A'), n('B')])
  ];
  const game = testGame(strips, { sticky_multipliers: { WILD: { 500: 1 }, BIG: { 2: 1 } } });
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0, 0, 0]), inFreeSpins: true, bonus: {} });
  assert.strictEqual(r.giants.find((g) => g.symbol === 'WILD').multiplier, 500);
  assert.strictEqual(r.giants.find((g) => g.symbol === 'BIG').multiplier, 2);
  assert.deepStrictEqual(giants.stickyValues({ WILD: { 1: 5, 500: 1 }, BIG: { 2: 1 } }, 'WILD'), [1, 500]);
  assert.deepStrictEqual(giants.stickyValues({ 2: 60, 3: 40 }, 'ANY'), [2, 3]);
  const gm = GAMES_CATALOG.enchanted_knight;
  assert.strictEqual(gm.max_win_x, 25000);
  assert.deepStrictEqual(giants.stickyValues(gm.free_spins.sticky_multipliers, 'WILD').slice(-1), [500]);
}
console.log('✔ Test 6: per-symbol sticky multiplier tables (Knight Wild x1 - x500)');



// ------------------------------------------------------------------ 7. giants skins: identical math to Enchanted Knight
{
  const { GIANT_SKINS } = require('../src/games/skins/giants');
  const tpl = GAMES_CATALOG.enchanted_knight;
  assert.strictEqual(GIANT_SKINS.length, 9);
  for (const sk of GIANT_SKINS) {
    const g = GAMES_CATALOG[sk.id];
    assert(g, `${sk.id} is in the catalog`);
    assert.strictEqual(g.mechanic, 'giants');
    assert.strictEqual(g.rtp, tpl.rtp);
    assert.strictEqual(g.max_win_x, tpl.max_win_x);
    assert.strictEqual(g.free_spins.buy_cost, tpl.free_spins.buy_cost);
    assert.deepStrictEqual(Object.values(g.giants), Object.values(tpl.giants));
    const giantId = Object.keys(g.giants).find((id) => id !== 'WILD');
    assert.deepStrictEqual(giants.stickyValues(g.free_spins.sticky_multipliers, 'WILD'), giants.stickyValues(tpl.free_spins.sticky_multipliers, 'WILD'));
    assert.deepStrictEqual(giants.stickyValues(g.free_spins.sticky_multipliers, giantId), [2, 3]);
    assert.deepStrictEqual(Object.values(g.paytable), Object.values(tpl.paytable), `${sk.id}: same pays`);
    // same seed -> same wins, spin for spin (base game + bought free spins)
    const ra = seededRng(1234);
    const rb = seededRng(1234);
    for (let i = 0; i < 400; i++) {
      const buy = i % 50 === 0;
      const a = RgsEngine.calculateSpin({ game: tpl, betAmount: tpl.default_bet, rng: ra, buyFeature: buy });
      const b = RgsEngine.calculateSpin({ game: g, betAmount: g.default_bet, rng: rb, buyFeature: buy });
      assert.strictEqual(b.total_win, a.total_win, `${sk.id}: spin ${i} pays like the template`);
      assert.strictEqual(b.free_spins.remaining, a.free_spins.remaining);
    }
    for (const s of Object.values(g.symbols)) if (s.tall_image) assert(require('node:fs').existsSync(`${__dirname}/../public${s.tall_image}`), `${sk.id}: ${s.tall_image} exists`);
    assert(require('node:fs').existsSync(`${__dirname}/../public${g.theme.stage.image}`), `${sk.id}: stage image exists`);
  }
}
console.log('✔ Test 7: 9 giants skins play exactly like Enchanted Knight');

// ------------------------------------------------------------------ 8. reel heights + full-reel giants (Tiki Titans)
{
  // hand-written 3-reel game: heights 2-3-2, WILD is a reel giant (1 cell on the strip, fills the reel)
  const strips = [
    strip([n('A'), n('A'), n('B'), n('B')]),
    strip([n('B'), n('WILD'), n('B'), n('B')]),
    strip([n('A'), n('B'), n('B'), n('B')])
  ];
  const game = { ...testGame(strips), rows_count: 3, reel_heights: [2, 3, 2], giants: { WILD: { height: 'reel' } }, free_spins: { trigger: 3, spins: 5, sticky_giants: true, sticky_multipliers: { WILD: { 5: 1, 5000: 1 } } } };
  const r = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0]) });
  assert.deepStrictEqual(r.matrix.map((row) => row[0]), ['A', 'A', null], 'cells below a short reel are null');
  assert.deepStrictEqual(r.matrix.map((row) => row[1]), ['WILD', 'WILD', 'WILD'], 'the totem grows over its whole reel');
  const w = r.giants.find((g) => g.symbol === 'WILD');
  assert.deepStrictEqual([w.top, w.height, w.full], [0, 3, true]);
  // A pays: reel0 A x2, reel1 wild (1 object), reel2 A x1 -> 2 ways
  const a = r.winning_lines.find((x) => x.symbol === 'A');
  assert.strictEqual(a.ways, 2);
  // free spins: the totem always sticks, with x5 or x5000
  const f = giants.play(game, { bet: 2000, rng: scripted([0, 0, 0, 1]), inFreeSpins: true, bonus: {} });
  assert.strictEqual(f.bonus.sticky.length, 1);
  assert([5, 5000].includes(f.bonus.sticky[0].multiplier));
  assert.strictEqual(f.bonus.sticky[0].height, 3);

  const tiki = GAMES_CATALOG.tiki_titans;
  assert.strictEqual(tiki.ways_count, 2 * 4 * 5 * 6 * 5 * 4 * 2);
  assert.deepStrictEqual(giants.stickyValues(tiki.free_spins.sticky_multipliers, 'WILD').filter((v, i, arr) => i === 0 || i === arr.length - 1), [5, 5000]);
  const rng = seededRng(99);
  let bonus = {};
  let stickies = 0;
  for (let i = 0; i < 3000; i++) {
    const res = giants.play(tiki, { bet: tiki.default_bet, rng, inFreeSpins: i % 2 === 1, bonus: i % 2 ? bonus : {} });
    res.matrix.forEach((row, rr) => row.forEach((cell, c) => assert.strictEqual(cell === null, rr >= tiki.reel_heights[c], 'null exactly outside the reel')));
    for (const g of res.giants.filter((x) => x.symbol === 'WILD')) {
      assert.strictEqual(g.top, 0);
      assert.strictEqual(g.height, tiki.reel_heights[g.reel], 'totem height = reel height');
      if (g.new_sticky) { stickies++; assert(g.multiplier >= 5 && g.multiplier <= 5000); }
    }
    bonus = i % 2 ? {} : res.bonus;
  }
  assert(stickies > 0, 'totems stick in free spins');
}
console.log('✔ Test 8: reel heights (2-4-5-6-5-4-2), full-reel totem wilds, sticky x5..x5000');

// ------------------------------------------------------------------ 9. reskin(): same math, new looks
{
  const { reskin } = require('../src/games/kit');
  const { buildGame } = require('../src/games/build');
  const tpl = require('../src/games/definitions/tiki_titans');
  const raw = reskin(tpl, { id: 'test_reskin', name: 'Test Reskin', theme: { accent: '#123456' }, symbols: { SHARK: { name: 'Sea Serpent' } } });
  assert.strictEqual(raw.symbols.SHARK.name, 'Sea Serpent');
  assert.strictEqual(raw.symbols.SHARK.tall_image, '/games/test_reskin/assets/giant.png', 'asset paths move to the skin folder');
  assert.strictEqual(raw.theme.stage.image, '/games/test_reskin/assets/stage.jpg');
  assert.strictEqual(tpl.theme.stage.image, '/games/tiki_titans/assets/stage.jpg', 'template untouched');
  const a = GAMES_CATALOG.tiki_titans;
  const b = buildGame(raw);
  assert.strictEqual(b.free_spins.buy_cost, a.free_spins.buy_cost);
  const ra = seededRng(77);
  const rb = seededRng(77);
  for (let i = 0; i < 300; i++) {
    const x = RgsEngine.calculateSpin({ game: a, betAmount: a.default_bet, rng: ra, buyFeature: i % 60 === 0 });
    const y = RgsEngine.calculateSpin({ game: b, betAmount: b.default_bet, rng: rb, buyFeature: i % 60 === 0 });
    assert.strictEqual(y.total_win, x.total_win, `spin ${i}: a reskin pays exactly like its template`);
  }
}
console.log('✔ Test 9: reskin() keeps the template math spin for spin');
console.log('All giants tests passed.');
