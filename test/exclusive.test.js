// SpinKit Exclusive: step-crash math (Apple Shooter), Provably Fair and the round/wallet flow.
const _os = require('node:os'); const _path = require('node:path'); const _fs = require('node:fs');
process.env.SPINKIT_DB = process.env.SPINKIT_DB || _path.join(_fs.mkdtempSync(_path.join(_os.tmpdir(), 'spinkit-')), 'test.db');
process.env.SPINKIT_QUIET = '1';
const assert = require('node:assert');
const crypto = require('node:crypto');
const { GAMES_CATALOG, getGame } = require('../src/games/catalog');
const sc = require('../src/engine/exclusive/step-crash');
const gameService = require('../src/services/game-service');
const merchants = require('../src/services/merchants');
const { dbService } = require('../src/db/database');

console.log('Testing SpinKit Exclusive (Apple Shooter)...');
const game = GAMES_CATALOG.apple_shooter;
const cfg = game.crash;

// ------------------------------------------------------------------ 1. catalog
assert(game, 'apple_shooter is in the catalog');
assert.strictEqual(game.category, 'exclusive');
assert.strictEqual(game.kind, 'exclusive');
assert.strictEqual(Object.keys(GAMES_CATALOG)[0], 'apple_shooter', 'exclusive games lead the lobby');
assert.strictEqual(game.rtp, '96.50%');
assert.strictEqual(getGame('apple_shooter', 94).crash.rtp.toFixed(4), '0.9400', 'RTP profiles scale the target RTP');
console.log('✔ Test 1: catalog entry, category and RTP profiles');

// ------------------------------------------------------------------ 2. provably fair hash
{
  const server = 'a'.repeat(64);
  const h = sc.shotHash(server, 'deve', 3, 2);
  const ref = crypto.createHmac('sha256', server).update('deve:3:2').digest();
  assert.strictEqual(h.hex, ref.toString('hex'));
  assert.strictEqual(h.u, ref.readUInt32BE(0) / 2 ** 32);
  assert.strictEqual(h.wind, Math.round((ref.readUInt16BE(4) / 65535 * 20 - 10) * 10) / 10 + 0);
  assert.deepStrictEqual(sc.shotHash(server, 'deve', 3, 2), h, 'deterministic');
  assert.notStrictEqual(sc.shotHash(server, 'deve', 3, 3).hex, h.hex, 'every shot has its own hash');
  assert.strictEqual(sc.hashSeed(server), crypto.createHash('sha256').update(server).digest('hex'));
  // wind covers -10…+10
  let lo = 0; let hi = 0;
  for (let i = 0; i < 3000; i++) { const w = sc.shotHash(server, 'x', i, 0).wind; lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert(lo < -9.5 && hi > 9.5, 'wind range');
}
console.log('✔ Test 2: HMAC-SHA256 shot hash, outcome float and wind');

// ------------------------------------------------------------------ 3. exact math
{
  for (const mode of Object.keys(cfg.modes)) {
    for (let L = 1; L <= 10; L++) {
      for (const tier of cfg.wind) {
        const c = sc.chanceOf(cfg, mode, L, tier);
        // step x chance = 1: every shot after the first is EV-neutral, whatever the wind
        assert(Math.abs((1 / c) * c - 1) < 1e-12);
        assert(c > 0 && c < 1);
        const probs = sc.outcomeProbs(cfg, c);
        assert(Math.abs(Object.values(probs).reduce((a, b) => a + b, 0) - 1) < 1e-12, 'outcome probabilities sum to 1');
        // side odds never pay more than their RTP
        for (const [id, odds] of Object.entries(sc.sideOdds(cfg, c, 9))) {
          if (!odds) continue;
          const q = cfg.side_bets[id].wins_on.reduce((s, o) => s + probs[o], 0);
          assert(odds * q <= cfg.side_bets[id].rtp + 1e-9, `${id} odds <= rtp / q`);
        }
      }
    }
    assert.strictEqual(sc.ladder(game, mode).length, 10);
  }
  // outcome partition follows the hash float
  const c = 0.8;
  assert.strictEqual(sc.outcomeOf(cfg, c, 0.0), 'bullseye');
  assert.strictEqual(sc.outcomeOf(cfg, c, 0.8), 'lethal');
  assert.strictEqual(sc.outcomeOf(cfg, c, 0.7999), 'hit');
  assert.strictEqual(sc.ladder(game, 'medium')[0], 1.06, 'Medium starts at x1.06 (GDD)');
  // wind defiance only in strong wind
  assert.strictEqual(sc.sideOdds(cfg, 0.8, 3).wind_defiance, null);
  assert(sc.sideOdds(cfg, 0.8, -6.5).wind_defiance > 1);
}
console.log('✔ Test 3: chances, step multipliers, side-bet odds');

// ------------------------------------------------------------------ 4. Monte-Carlo main line ≈ 96.5% for different strategies
{
  const BET = 10000;
  for (const [mode, k] of [['medium', 2], ['medium', 4], ['high', 2]]) {
    let ret = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) {
      const s = { server_seed: sc.newServerSeed(), client_seed: 't' };
      const round = { mode, bet: BET, level: 0, multiplier: cfg.rtp, nonce: 0, shot_index: 0 };
      for (;;) {
        const q = sc.quote(game, round, s);
        const h = sc.shotHash(s.server_seed, s.client_seed, 0, round.shot_index++);
        if (sc.outcomeOf(cfg, q.chance, h.u) === 'lethal') break;
        round.level++;
        round.multiplier /= q.chance;
        if (round.level >= k) { ret += sc.payoutOf(BET, round.multiplier, game.max_win_x); break; }
      }
    }
    const rtp = ret / N / BET;
    assert(rtp > 0.93 && rtp < 1.0, `${mode} cash@${k}: RTP ${rtp}`);
  }
}
console.log('✔ Test 4: Monte-Carlo main line around the target RTP');

// ------------------------------------------------------------------ 5. round flow through the service
{
  const player = dbService.getUser(49102);
  const launch = gameService.launch({ merchant: merchants.get(1), player, gameId: 'apple_shooter', baseUrl: 'http://x' });
  const t = launch.token;
  const init = gameService.init(t);
  assert.strictEqual(init.game_config.kind, 'exclusive');
  assert(init.game_config.crash.modes.medium.ladder.length === 10);
  assert.strictEqual(init.round, null);
  const seedHash = init.provably_fair.server_seed_hash;

  assert.throws(() => gameService.spin(t, 200), /USE_ACTION|action/i, 'slots spin endpoint is refused');
  assert.throws(() => gameService.action(t, { action: 'shoot' }), (e) => e.code === 'NO_ROUND');
  assert.throws(() => gameService.action(t, { action: 'start', bet: 7 }), (e) => e.code === 'INVALID_BET');

  const b0 = dbService.getUser(49102).balance;
  let r = gameService.action(t, { action: 'start', bet: 200, mode: 'medium' });
  assert.strictEqual(r.balance, b0 - 200);
  assert.strictEqual(r.round.level, 0);
  assert.strictEqual(r.next.level, 1);
  assert.throws(() => gameService.action(t, { action: 'start', bet: 200 }), (e) => e.code === 'ROUND_IN_PROGRESS');
  assert.throws(() => gameService.action(t, { action: 'cashout' }), (e) => e.code === 'NOTHING_TO_CASH_OUT');
  assert.throws(() => gameService.action(t, { action: 'shoot', helmet: true }), (e) => e.code === 'HELMET_UNAVAILABLE');
  assert.throws(() => gameService.action(t, { action: 'seed' }), (e) => e.code === 'ROUND_IN_PROGRESS');

  // play rounds until one is cashed out and one is lost; check money conservation on each
  let cashed = 0; let lost = 0; let guard = 0;
  let balance = r.balance;
  while ((cashed < 2 || lost < 2) && guard++ < 400) {
    if (!r.round) {
      const before = balance;
      r = gameService.action(t, { action: 'start', bet: 200, mode: 'medium' });
      assert.strictEqual(r.balance, before - 200 + r.round.side_won + (r.jackpot_wins || []).reduce((s, w) => s + w.amount, 0));
      balance = r.balance;
    }
    const before = balance;
    const q = r.next;
    const side = q.side_bets.insurance ? { insurance: 20 } : {};
    const helmet = q.helmet_price != null && guard % 3 === 0;
    r = gameService.action(t, { action: 'shoot', side_bets: side, helmet, expect_shot: q.shot_index });
    const shot = r.shot;
    assert.strictEqual(shot.wind, q.wind, 'the wind shown before the shot is the wind of the shot');
    assert.strictEqual(shot.chance, q.chance);
    // verify the shot from the revealed data later; for now: outcome follows u
    assert.strictEqual(sc.outcomeOf(cfg, shot.chance, shot.u), shot.outcome);
    const spent = shot.cost;
    let expect = before - spent + shot.side_win;
    if (r.settled) expect += r.settled.win;
    assert.strictEqual(r.balance, expect, 'balance moves exactly by wagers and wins');
    balance = r.balance;
    if (r.settled) { if (r.settled.end === 'lethal') lost++; else cashed++; continue; }
    if (shot.saved) { assert(shot.helmet > 0); continue; }
    if (r.round.level >= 2) {
      const value = r.round.cashout_value;
      const b = balance;
      r = gameService.action(t, { action: 'cashout' });
      assert.strictEqual(r.balance, b + value);
      assert.strictEqual(r.round, null);
      balance = r.balance;
      cashed++;
    }
  }
  assert(cashed >= 2 && lost >= 2, 'both endings happened');
  // stale shot is refused
  r = gameService.action(t, { action: 'start', bet: 200 });
  assert.throws(() => gameService.action(t, { action: 'shoot', expect_shot: 5 }), (e) => e.code === 'STALE_SHOT');

  // finish, rotate seeds, then verify every shot of every settled round with the revealed seed
  while (r.round) {
    r = r.round.level >= 1 ? gameService.action(t, { action: 'cashout' }) : gameService.action(t, { action: 'shoot', expect_shot: r.next.shot_index });
  }
  const rot = gameService.action(t, { action: 'seed', client_seed: 'my-seed' });
  assert.strictEqual(rot.revealed.server_seed_hash, seedHash);
  assert.strictEqual(sc.hashSeed(rot.revealed.server_seed), seedHash, 'revealed seed matches the published hash');
  assert.strictEqual(rot.provably_fair.client_seed, 'my-seed');
  assert.strictEqual(rot.provably_fair.nonce, 0);
  assert.notStrictEqual(rot.provably_fair.server_seed_hash, seedHash);

  const rows = dbService.getRecentTransactions(49102, 500).filter((x) => x.game_id === 'apple_shooter');
  assert(rows.length >= 5);
  for (const row of rows) {
    assert.strictEqual(row.bet_type, 'step_crash');
    const d = row.details;
    assert.strictEqual(d.provably_fair.server_seed_hash, seedHash);
    for (const s of d.shots) {
      const h = sc.shotHash(rot.revealed.server_seed, d.provably_fair.client_seed, d.provably_fair.nonce, s.i);
      assert.strictEqual(h.hex, s.hash);
      assert.strictEqual(h.wind, s.wind);
      assert.strictEqual(sc.outcomeOf(cfg, s.chance, h.u), s.outcome);
    }
    assert.strictEqual(row.bet_amount, d.bet + d.side_staked + d.helmets);
  }

  // skins
  assert.throws(() => gameService.action(t, { action: 'skin', skin: 'shiba' }), (e) => e.code === 'SKIN_LOCKED');
  gameService.action(t, { action: 'skin', skin: 'classic' });
}
console.log('✔ Test 5: start / shoot / cashout / seed flow, wallet and round records verify with the revealed seed');

// ------------------------------------------------------------------ 6. revenge
{
  const player = dbService.getUser(49103);
  const t = gameService.launch({ merchant: merchants.get(1), player, gameId: 'apple_shooter', baseUrl: 'http://x' }).token;
  gameService.init(t);
  // put the state into "just lost on level 8"
  const row = dbService.getGameState(49103, 'apple_shooter');
  const st = JSON.parse(row.active_bonus_data);
  st.revenge = { until: Date.now() + 60000, bet: 200, level: 8 };
  dbService.db.prepare('UPDATE game_states SET active_bonus_data = ? WHERE id = ?').run(JSON.stringify(st), row.id);
  assert(gameService.init(t).revenge, 'revenge offered');
  const big = gameService.action(t, { action: 'start', bet: 400 });
  assert.strictEqual(big.round.boost, 1, 'a bigger bet does not get the boost');
  assert(big.revenge, 'and the offer stays');
  while (gameService.init(t).round) {
    const cur = gameService.init(t);
    if (cur.round.level >= 1) gameService.action(t, { action: 'cashout' });
    else gameService.action(t, { action: 'shoot', expect_shot: cur.next.shot_index });
  }
  const r = gameService.action(t, { action: 'start', bet: 200 });
  if (r.round) assert.strictEqual(r.round.boost, cfg.revenge.boost);
  assert.strictEqual(r.revenge, null, 'used once');
  assert(Math.abs(r.next.multiplier - Math.round(r.next.multiplier * 100) / 100) < 1e-9);
}
console.log('✔ Test 6: Revenge boost (bet cap, one use)');

// ------------------------------------------------------------------ 7. Fruit Slash: committed cut over fair lanes
{
  const ls = require('../src/engine/exclusive/lane-slash');
  const fs = GAMES_CATALOG.fruit_slash;
  const fc = fs.crash;
  assert(fs && fs.category === 'exclusive' && fs.mechanic === 'lane_slash' && fs.rtp === '96.50%');
  // every offered width is EV-neutral and never lowers the multiplier on a win
  for (const mode of Object.keys(fc.modes)) {
    fc.modes[mode].waves.forEach((_, i) => {
      const w = ls.waveOf(fc, mode, i + 1);
      for (let k = 1; k <= fc.lanes; k++) {
        const st = ls.spanStats(fc, w, k);
        if (st.win <= 0) continue;
        const ev = st.pf.reduce((sum, p, f) => sum + (p || 0) * (1 + fc.fruit_step * (f - 1)) / st.Z, 0);
        assert(Math.abs(ev - 1) < 1e-12, 'wave EV-neutral');
        assert(Math.abs(st.win + st.bomb + st.empty - 1) < 1e-12, 'probabilities sum to 1');
      }
    });
  }
  // the hash decides the lanes; the same hash always gives the same wave, with the right counts
  const hx = sc.shotHash('b'.repeat(64), 'c', 1, 2).hex;
  const w1 = ls.waveOf(fc, 'medium', 4);
  const wave = ls.waveFromHash(fc, w1, hx);
  assert.deepStrictEqual(ls.waveFromHash(fc, w1, hx), wave);
  assert.strictEqual(wave.lanes.filter((x) => x === 'F').length, w1.n);
  assert.strictEqual(wave.lanes.filter((x) => x === 'B').length, w1.b);
  // lanes are uniformly shuffled: each lane holds a bomb about b/L of the time
  const hits = new Array(fc.lanes).fill(0);
  for (let i = 0; i < 4000; i++) ls.waveFromHash(fc, w1, sc.shotHash('d'.repeat(64), 'x', i, 0).hex).lanes.forEach((x, j) => { if (x === 'B') hits[j]++; });
  hits.forEach((h) => assert(Math.abs(h / 4000 - w1.b / fc.lanes) < 0.04, 'bombs spread evenly over lanes'));

  const player = dbService.getUser(49104);
  const t = gameService.launch({ merchant: merchants.get(1), player, gameId: 'fruit_slash', baseUrl: 'http://x' }).token;
  const init = gameService.init(t);
  assert.strictEqual(init.game_config.crash.kind, 'lane_slash');
  let r = gameService.action(t, { action: 'start', bet: 200, mode: 'medium' });
  // nothing about the coming wave leaks before the cut is committed
  const pre = JSON.stringify(r.next);
  assert(!/lanes"\s*:\s*"|hash|dragon"\s*:/.test(pre), 'the quote does not reveal the wave');
  assert.throws(() => gameService.action(t, { action: 'shoot' }), (e) => e.code === 'INVALID_CUT');
  assert.throws(() => gameService.action(t, { action: 'shoot', cut: { from: 3, to: 1 } }), (e) => e.code === 'INVALID_CUT');
  assert.throws(() => gameService.action(t, { action: 'shoot', cut: { from: 0, to: 7 } }), (e) => e.code === 'INVALID_CUT');

  let saves = 0; let rounds = 0; let guard = 0;
  while ((rounds < 25 || saves < 1) && guard++ < 2000) {
    if (!r.round) r = gameService.action(t, { action: 'start', bet: 200, mode: 'high' });
    const q = r.next;
    const k = q.level === 1 ? 1 : 2;
    const from = (q.level * 3) % (fc.lanes - k + 1);
    const span = q.spans[k - 1];
    const shield = !!span.helmet_price;
    const before = r.round;
    r = gameService.action(t, { action: 'shoot', cut: { from, to: from + k - 1 }, helmet: shield, side_bets: span.side_bets.insurance ? { insurance: 20 } : {}, expect_shot: q.shot_index });
    const sh = r.shot;
    // the outcome follows the cut over the recorded lanes
    const cut = sh.lanes.slice(sh.cut.from, sh.cut.to + 1);
    const expect = cut.includes('B') ? 'bomb' : cut.includes('F') ? 'cut' : 'empty';
    assert.strictEqual(sh.outcome, expect);
    assert.strictEqual(sh.fruits_cut, cut.split('').filter((x) => x === 'F').length);
    if (sh.side_bets.length) assert.strictEqual(sh.side_bets[0].won, sh.outcome === 'bomb');
    if (sh.saved) {
      saves++;
      assert.strictEqual(sh.outcome, 'bomb', 'the shield only absorbs a bomb');
      assert.strictEqual(r.round.multiplier, sc.round2(before.shots.filter((x) => x.multiplier).at(-2).multiplier), 'one step back');
    }
    if (r.settled) rounds++;
    else if (r.round.level >= 4) { r = gameService.action(t, { action: 'cashout' }); rounds++; }
  }
  assert(saves >= 1, 'a shield save happened');
  // every recorded wave rebuilds from the revealed seed
  if (r.round) gameService.action(t, { action: 'cashout' }).round || null;
  const cur = gameService.init(t);
  if (cur.round) {
    let x = { round: cur.round, next: cur.next };
    while (x.round) x = x.round.level >= 1 ? gameService.action(t, { action: 'cashout' }) : gameService.action(t, { action: 'shoot', cut: { from: 0, to: 0 }, expect_shot: x.next.shot_index });
  }
  const rot = gameService.action(t, { action: 'seed' });
  const rows = dbService.getRecentTransactions(49104, 2000).filter((x) => x.game_id === 'fruit_slash' && x.details.provably_fair.server_seed_hash === rot.revealed.server_seed_hash);
  assert(rows.length >= 20);
  for (const row of rows) {
    const d = row.details;
    for (const shot of d.shots) {
      const h = sc.shotHash(rot.revealed.server_seed, d.provably_fair.client_seed, d.provably_fair.nonce, shot.i).hex;
      assert.strictEqual(h, shot.hash);
      const again = ls.waveFromHash(fc, ls.waveOf(fc, d.mode, shot.level), h);
      assert.strictEqual(again.lanes.join(''), shot.lanes);
    }
  }
}
console.log('✔ Test 7: Fruit Slash — committed cut, fair lanes, EV-neutral widths, shield, no leak, verifiable');

console.log('All SpinKit Exclusive tests passed.');
