#!/usr/bin/env node
/**
 * Monte-Carlo simulator & RTP calibrator.
 *
 *   node scripts/simulate.js                       # report all games (200k rounds each)
 *   node scripts/simulate.js --game olympus_thunder --rounds 1000000
 *   node scripts/simulate.js --calibrate --write   # tune pay_scale + buy cost to TARGET_RTP
 *
 * A "round" = one paid base spin plus the whole free-spins session it triggers.
 */
const fs = require('node:fs');
const path = require('node:path');
const { RgsEngine } = require('../src/engine/rgs');
const { RAW_GAMES, CALIBRATION, buildGame } = require('../src/games/catalog');
const { fastRng } = require('../src/engine/rng');

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ROUNDS = Number(arg('rounds', 200000));
const ONLY = arg('game', null);
const TARGET = Number(arg('target', 0.96));
const CALIBRATE = args.includes('--calibrate');
const WRITE = args.includes('--write');

function playRound(game, rng, bet, buy = false) {
  const base = RgsEngine.calculateSpin({ game, betAmount: bet, rng, buyFeature: buy });
  let win = base.total_win;
  let fsWin = 0;
  let state = null;
  if (base.free_spins.remaining > 0) {
    state = {
      free_spins_left: base.free_spins.remaining,
      free_spins_bet: bet,
      free_spins_total_win: 0,
      active_bonus_data: base.bonus
    };
    let guard = 0;
    while (state.free_spins_left > 0 && guard++ < 1000) {
      const r = RgsEngine.calculateSpin({ game, betAmount: bet, rng, activeState: state });
      fsWin += r.total_win;
      state.free_spins_total_win += r.total_win;
      state.free_spins_left = r.free_spins.remaining;
      state.active_bonus_data = r.bonus;
    }
  }
  return { baseWin: win, fsWin, triggered: !!state, total: win + fsWin };
}

function simulate(game, rounds) {
  const rng = fastRng();
  const bet = game.default_bet;
  let totalBet = 0, totalWin = 0, baseWin = 0, fsWin = 0, hits = 0, triggers = 0, maxX = 0;
  const buckets = { '0': 0, '<1x': 0, '1-5x': 0, '5-20x': 0, '20-100x': 0, '100-1000x': 0, '1000x+': 0 };
  for (let i = 0; i < rounds; i++) {
    const r = playRound(game, rng, bet);
    totalBet += bet;
    totalWin += r.total;
    baseWin += r.baseWin;
    fsWin += r.fsWin;
    if (r.baseWin > 0) hits++;
    if (r.triggered) triggers++;
    const x = r.total / bet;
    if (x > maxX) maxX = x;
    if (x === 0) buckets['0']++;
    else if (x < 1) buckets['<1x']++;
    else if (x < 5) buckets['1-5x']++;
    else if (x < 20) buckets['5-20x']++;
    else if (x < 100) buckets['20-100x']++;
    else if (x < 1000) buckets['100-1000x']++;
    else buckets['1000x+']++;
  }
  return {
    rtp: totalWin / totalBet,
    baseRtp: baseWin / totalBet,
    fsRtp: fsWin / totalBet,
    hitRate: hits / rounds,
    fsEvery: triggers ? rounds / triggers : Infinity,
    maxX,
    buckets
  };
}

function simulateBuy(game, rounds) {
  const rng = fastRng();
  const bet = game.default_bet;
  let total = 0;
  for (let i = 0; i < rounds; i++) total += playRound(game, rng, bet, true).total;
  return total / rounds / bet; // average win in x bet
}

const pct = (v) => (v * 100).toFixed(2) + '%';

const results = {};
for (const raw of RAW_GAMES) {
  if (ONLY && raw.id !== ONLY) continue;
  const t0 = Date.now();
  let scale = (CALIBRATION[raw.id] && CALIBRATION[raw.id].pay_scale) || raw.pay_scale || 1;
  // buildGame reads CALIBRATION first; override it while simulating
  const make = (s) => {
    const saved = CALIBRATION[raw.id];
    CALIBRATION[raw.id] = { ...(saved || {}), pay_scale: s };
    const g = buildGame(raw);
    if (saved) CALIBRATION[raw.id] = saved; else delete CALIBRATION[raw.id];
    return g;
  };
  let game = make(scale);

  let s = simulate(game, ROUNDS);
  if (CALIBRATE) {
    for (let iter = 0; iter < 4; iter++) {
      const err = Math.abs(s.rtp - TARGET);
      if (err < 0.003) break;
      scale = scale * (TARGET / s.rtp);
      game = make(scale);
      s = simulate(game, ROUNDS);
    }
  }

  let buyCost = null;
  if (game.free_spins && game.free_spins.buy) {
    const avgX = simulateBuy(game, Math.max(5000, Math.round(ROUNDS / 20)));
    buyCost = Math.max(20, Math.ceil(avgX / TARGET / 5) * 5);
    s.buyAvgX = avgX;
    s.buyCost = buyCost;
    s.buyRtp = avgX / buyCost;
  }

  results[raw.id] = {
    pay_scale: Number(scale.toFixed(4)),
    rtp: (s.rtp * 100).toFixed(2) + '%',
    hit_rate: (s.hitRate * 100).toFixed(1) + '%',
    fs_frequency: s.fsEvery === Infinity ? null : `1 in ${Math.round(s.fsEvery)}`,
    ...(buyCost ? { buy_cost: buyCost } : {})
  };

  console.log(`\n=== ${raw.name} (${raw.mechanic}, ${raw.reels_count}x${raw.rows_count}) — ${ROUNDS.toLocaleString()} rounds, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  pay_scale ${scale.toFixed(4)}`);
  console.log(`  RTP ${pct(s.rtp)}  (base ${pct(s.baseRtp)} + free spins ${pct(s.fsRtp)})`);
  console.log(`  hit rate ${pct(s.hitRate)}   free spins 1 in ${Math.round(s.fsEvery)}   max win ${s.maxX.toFixed(0)}x`);
  if (buyCost) console.log(`  feature buy: avg ${s.buyAvgX.toFixed(1)}x -> cost ${buyCost}x bet (RTP ${pct(s.buyRtp)})`);
  console.log('  distribution', Object.entries(s.buckets).map(([k, v]) => `${k}: ${pct(v / ROUNDS)}`).join('  '));
}

if (WRITE) {
  const file = path.join(__dirname, '../src/games/calibration.json');
  const merged = { ...CALIBRATION, ...results };
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  console.log('\nCALIBRATION written to src/games/calibration.json');
}
