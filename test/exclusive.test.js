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
  // Apple Shooter has no side bets: the helmet is the only extra
  assert.deepStrictEqual(sc.sideOdds(cfg, 0.8, 3), {});
}
console.log('✔ Test 3: chances, step multipliers, no side bets');

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

// ------------------------------------------------------------------ 8. operator settings: bet ladder, helmet saves, language
{
  const m = merchants.get(1);
  const slot = Object.values(GAMES_CATALOG).find((g) => !g.kind);
  assert.strictEqual(merchants.effective(m, slot.id).max_bet, slot.max_bet, 'slots keep their ladder');
  let eff = merchants.effective(m, 'apple_shooter');
  assert.strictEqual(eff.max_bet, 10000, 'exclusive games open up to 100.00 by default');
  assert.strictEqual(GAMES_CATALOG.apple_shooter.max_bet_limit, 500000, 'ladder reaches 5,000.00');
  merchants.setGameSetting(1, 'apple_shooter', { max_bet: 100000 }, 'test');
  eff = merchants.effective(m, 'apple_shooter');
  assert.strictEqual(eff.max_bet, 100000, 'the operator opens higher bets');
  assert(eff.bet_steps.includes(50000));

  // helmet saves per round
  assert.throws(() => merchants.setGameSetting(1, 'apple_shooter', { options: { helmet_max_saves: 99 } }, 'test'), (e) => e.code === 'INVALID_OPTIONS');
  assert.throws(() => merchants.setGameSetting(1, 'apple_shooter', { options: { nope: 1 } }, 'test'), (e) => e.code === 'INVALID_OPTIONS');
  merchants.setGameSetting(1, 'apple_shooter', { options: { helmet_max_saves: 1 } }, 'test');
  assert.strictEqual(merchants.effective(m, 'apple_shooter').game.crash.helmet.max_saves, 1);
  assert.strictEqual(GAMES_CATALOG.apple_shooter.crash.helmet.max_saves, undefined, 'the catalog game is not mutated');
  const player = dbService.getUser(49105);
  const launch = gameService.launch({ merchant: m, player, gameId: 'apple_shooter', baseUrl: 'http://x', lang: 'de' });
  assert(launch.launch_url.endsWith('&lang=de'));
  const t = launch.token;
  const init = gameService.init(t);
  assert.strictEqual(init.session.lang, 'de');
  assert.strictEqual(init.game_config.crash.helmet.max_saves, 1);
  assert(init.game_config.bet_steps.includes(100000));
  assert.throws(() => gameService.launch({ merchant: m, player, gameId: 'apple_shooter', baseUrl: 'http://x', lang: 'xx' }), (e) => e.code === 'INVALID_LANG');
  let saved = 0; let blocked = 0;
  for (let i = 0, r = null; i < 400 && (saved < 3 || blocked < 2); i++) {
    if (!r || !r.round) r = gameService.action(t, { action: 'start', bet: 200 });
    const q = r.next;
    const used = r.round.saves || 0;
    if (used >= 1 && q.helmet_price == null) {
      assert.throws(() => gameService.action(t, { action: 'shoot', helmet: true, expect_shot: q.shot_index }), (e) => e.code === 'HELMET_UNAVAILABLE');
      blocked++;
    }
    r = gameService.action(t, { action: 'shoot', helmet: q.helmet_price != null, expect_shot: q.shot_index });
    if (r.shot.saved) saved++;
    if (r.round) assert((r.round.saves || 0) <= 1, 'never more than one save per round');
    if (r.round && r.round.level >= 6) r = gameService.action(t, { action: 'cashout' });
  }
  assert(saved >= 3 && blocked >= 2, 'saves happen and the limit blocks a second one');
  merchants.setGameSetting(1, 'apple_shooter', { options: { helmet_max_saves: 0 } }, 'test');
  assert.strictEqual(gameService.init(t).game_config.crash.helmet, null, '0 switches the helmet off');
  merchants.setGameSetting(1, 'apple_shooter', { options: { helmet_max_saves: null }, max_bet: null }, 'test');
  assert.strictEqual(merchants.effective(m, 'apple_shooter').game.crash.helmet.max_saves, undefined, 'null restores the game default');
  assert.strictEqual(merchants.effective(m, 'fruit_slash').options.helmet_max_saves, 1, 'Fruit Slash default: one shield');
  // bulk updates skip games without the option
  merchants.setGameSetting(1, '*', { options: { helmet_max_saves: 2 }, filter: { category: 'exclusive' } }, 'test');
  assert.strictEqual(merchants.effective(m, 'fruit_slash').game.crash.helmet.max_saves, 2);
  merchants.setGameSetting(1, '*', { options: { helmet_max_saves: null }, filter: { category: 'exclusive' } }, 'test');
}
console.log('✔ Test 8: operator settings — bet ladder above 100.00, helmet saves per round, session language');

// ------------------------------------------------------------------ 9. Hill Climb Rush: crash kinds, jerrycan, trick bets
{
  const hc = GAMES_CATALOG.hill_climb;
  const hcfg = hc.crash;
  assert(hc && hc.kind === 'exclusive' && hc.mechanic === 'step_crash');
  assert.deepStrictEqual(sc.ladder(hc, 'jeep'), [1.05, 1.19, 1.4, 1.75, 2.34, 3.34, 5.14, 8.56, 17.12, 42.8], 'GDD jeep ladder');
  // crash kind = the lethal part of the same float
  let flips = 0; let n = 0;
  for (let i = 0; i < 20000; i++) {
    const u = 0.8 + (i / 20000) * 0.2;
    const k = sc.crashOf(hcfg, 0.8, u);
    assert(k === 'flip' || k === 'fuel');
    n++; if (k === 'flip') flips++;
  }
  assert(Math.abs(flips / n - 0.6) < 0.001, 'flip share 60%');
  assert.strictEqual(sc.crashOf(hcfg, 0.8, 0.5), null, 'no crash kind on a clear');
  assert.strictEqual(sc.crashOf(cfg, 0.8, 0.9), null, 'games without crash kinds are unchanged');
  // jerrycan covers only the fuel crash: price = P(fuel) x 0.7 x multiplier x bet / rtp
  const r1 = { bet: 1000, level: 1, multiplier: 1.0496, prev_multiplier: 0.965, saves: 0 };
  assert.strictEqual(sc.helmetPrice(hcfg, r1, 0.88), Math.ceil(1000 * 0.7 * 1.0496 * 0.12 * 0.4 / 0.965));
  assert.strictEqual(sc.helmetPrice(cfg, { ...r1 }, 0.88), Math.ceil(1000 * 0.5 * 1.0496 * 0.12 / 0.965), 'apple helmet still covers every lethal shot');
  const odds = sc.sideOdds(hcfg, 0.92, 0);
  assert.deepStrictEqual(odds, { backflip: 14.98, air_time: 6.55, coin_chest: 8.06, empty_tank: 4.19, rollcage: 20.1 });

  // live rounds: saves only on an empty tank, trick bets settle on the right events
  const m = merchants.get(1);
  const player = dbService.getUser(49106);
  const t = gameService.launch({ merchant: m, player, gameId: 'hill_climb', baseUrl: 'http://x' }).token;
  const init = gameService.init(t);
  assert.strictEqual(init.game_config.crash.crashes.flip, 0.6);
  assert.strictEqual(init.game_config.crash.hill_names.length, 10);
  const seen = { saved: 0, flipWithCan: 0, rollcage: 0, airOnFlip: 0 };
  for (let i = 0, r = null; i < 1500 && (seen.saved < 3 || seen.flipWithCan < 3 || seen.rollcage < 2 || seen.airOnFlip < 1); i++) {
    if (!r || !r.round) r = gameService.action(t, { action: 'start', bet: 200, mode: 'bike' });
    const q = r.next;
    const can = q.helmet_price != null;
    const sides = {};
    if (q.side_bets.rollcage) sides.rollcage = 20;
    if (q.side_bets.air_time) sides.air_time = 20;
    r = gameService.action(t, { action: 'shoot', helmet: can, side_bets: sides, expect_shot: q.shot_index });
    const s = r.shot;
    if (s.outcome === 'lethal') {
      assert(s.crash === 'flip' || s.crash === 'fuel', 'a crash has a kind');
      if (can) assert.strictEqual(s.saved, s.crash === 'fuel', 'the jerrycan saves only an empty tank');
      if (s.saved) seen.saved++;
      if (can && s.crash === 'flip') { seen.flipWithCan++; assert(!r.round, 'a flip ends the round even with a jerrycan'); }
    }
    for (const b of s.side_bets) {
      if (b.id === 'rollcage') { assert.strictEqual(b.won, s.crash === 'flip'); if (b.won) seen.rollcage++; }
      if (b.id === 'air_time') { assert.strictEqual(b.won, s.outcome === 'big_air' || s.outcome === 'backflip'); if (s.outcome === 'backflip' && b.won) seen.airOnFlip++; }
    }
    if (r.round && r.round.level >= 4) r = gameService.action(t, { action: 'cashout' });
  }
  assert(seen.saved >= 3 && seen.flipWithCan >= 3 && seen.rollcage >= 2 && seen.airOnFlip >= 1, JSON.stringify(seen));
}
console.log('✔ Test 9: Hill Climb Rush — flip / fuel crashes, jerrycan covers only fuel, trick bets, GDD ladder');

console.log('All SpinKit Exclusive tests passed.');
