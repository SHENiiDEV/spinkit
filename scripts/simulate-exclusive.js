#!/usr/bin/env node
/**
 * RTP report for SpinKit Exclusive step-crash games.
 *
 *   node scripts/simulate-exclusive.js                         # exact math for apple_shooter
 *   node scripts/simulate-exclusive.js --mc 200000             # + Monte-Carlo with the real fair hash
 *   node scripts/simulate-exclusive.js --game apple_shooter
 *
 * Exact part: the wind of a shot comes from 2 hash bytes, so the probability of each wind tier is
 * counted over all 65,536 values; the main line is evaluated over every path of wind tiers
 * (4^10 paths) including the rounding of displayed multipliers. Reports, per mode:
 *   - main line RTP for "cash out after k shots", k = 1…10
 *   - each side bet (odds are rounded down per level and tier)
 *   - helmet RTP, Revenge overhead for a player chasing level k
 */
const { buildGame } = require('../src/games/build');
const EXCLUSIVE = require('../src/games/exclusive');
const sc = require('../src/engine/exclusive/step-crash');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const GAME = arg('game', 'apple_shooter');
const MC = Number(arg('mc', 0));
const raw = EXCLUSIVE.find((g) => g.id === GAME);
if (!raw) throw new Error(`Unknown exclusive game ${GAME}`);

const BET = 10000; // 100.00: rounding to minor units is negligible but included
const pct = (v) => (v * 100).toFixed(3) + '%';

/** Probability of each wind tier, exact over the 65,536 hash values. */
function tierProbs(cfg) {
  if (!cfg.wind) return [{ tier: sc.windTier(cfg, 0), p: 1 }];
  const counts = new Map(cfg.wind.map((t) => [t.id, 0]));
  for (let v = 0; v < 65536; v++) {
    const wind = Math.round((v / 65535 * 20 - 10) * 10) / 10;
    counts.set(sc.windTier(cfg, wind).id, counts.get(sc.windTier(cfg, wind).id) + 1);
  }
  return cfg.wind.map((t) => ({ tier: t, p: counts.get(t.id) / 65536 }));
}

/**
 * Exact main line: returns, for k = 1…levels, E[payout] / bet when cashing out after k shots,
 * plus P(lethal on level L) for L = 1…levels when chasing the top.
 */
function mainLine(game, mode, boost = 1) {
  const cfg = game.crash;
  const tiers = tierProbs(cfg);
  const levels = sc.levelsOf(cfg);
  const ev = new Array(levels + 1).fill(0);
  const deathAt = new Array(levels + 1).fill(0);
  // depth-first over tier paths: (level cleared, multiplier, probability)
  (function walk(level, mult, prob) {
    if (level > 0) ev[level] += prob * sc.payoutOf(BET, mult, game.max_win_x) / BET;
    if (level === levels) return;
    if (level > 0 && sc.payoutOf(BET, mult, game.max_win_x) >= BET * game.max_win_x) {
      for (let k = level + 1; k <= levels; k++) ev[k] += prob * game.max_win_x; // auto cash-out at the cap
      return;
    }
    for (const { tier, p } of tiers) {
      const c = sc.chanceOf(cfg, mode, level + 1, tier);
      deathAt[level + 1] += prob * p * (1 - c);
      const b = cfg.bonus;
      if (b) {
        const s = cfg.outcomes[b.outcome];
        walk(level + 1, mult * sc.clearFactor(cfg, c, b.outcome), prob * p * c * s);
        walk(level + 1, mult * sc.clearFactor(cfg, c, null), prob * p * c * (1 - s));
      } else {
        walk(level + 1, mult * sc.clearFactor(cfg, c, null), prob * p * c);
      }
    }
  })(0, cfg.rtp * boost, 1);
  return { ev, deathAt };
}

/** Exact side-bet RTP for one shot on a level, averaged over the wind (only shots where it is offered). */
function sideRtp(game, mode, id, level) {
  const cfg = game.crash;
  const sb = cfg.side_bets[id];
  let w = 0;
  let r = 0;
  for (let v = 0; v < 65536; v++) {
    const wind = Math.round((v / 65535 * 20 - 10) * 10) / 10;
    const c = sc.chanceOf(cfg, mode, level, sc.windTier(cfg, wind));
    const odds = sc.sideOdds(cfg, c, wind)[id];
    if (!odds) continue;
    const probs = sc.outcomeProbs(cfg, c);
    const q = sb.wins_on.reduce((s, o) => s + probs[o], 0);
    w += 1;
    r += q * Math.floor(BET * odds) / BET;
  }
  return w ? r / w : null;
}

/** Exact save (helmet / shield) RTP on a level, on the calm ladder: return = P(lethal) x value kept; price rounded up. */
function helmetRtp(game, mode, level) {
  const cfg = game.crash;
  const tiers = tierProbs(cfg);
  const calm = [cfg.rtp, ...sc.ladder(game, mode)];
  const round = { bet: BET, level: level - 1, multiplier: calm.at(level - 1), prev_multiplier: level > 2 ? calm.at(level - 2) : null, saves: 0 };
  let w = 0;
  let r = 0;
  for (const { tier, p } of tiers) {
    const c = sc.chanceOf(cfg, mode, level, tier);
    const price = sc.helmetPrice(cfg, round, c);
    w += p * price;
    r += p * (1 - c) * sc.savedMultiplier(cfg, round) * BET;
  }
  return r / w;
}

const game = buildGame(raw);
const cfg = game.crash;
const levels = sc.levelsOf(cfg);
console.log(`${game.name} — exact RTP report (target ${pct(cfg.rtp)})`);
if (cfg.wind) console.log(`wind tiers: ${tierProbs(cfg).map(({ tier, p }) => `${tier.label} ${(p * 100).toFixed(1)}% (+${tier.bonus * 100}%)`).join(' · ')}\n`);

const summary = {};
for (const mode of Object.keys(cfg.modes)) {
  const { ev, deathAt } = mainLine(game, mode);
  const boosted = cfg.revenge ? mainLine(game, mode, cfg.revenge.boost).ev : null;
  console.log(`== ${cfg.modes[mode].label}   calm ladder ${sc.ladder(game, mode).map((m) => 'x' + m).join(' ')}`);
  console.log('  main line, cash out after k steps:');
  console.log('   ' + ev.slice(1).map((v, i) => `${i + 1}: ${pct(v)}`).join('  '));
  const survive = (k) => 1 - deathAt.slice(1, k + 1).reduce((a, b) => a + b, 0);
  console.log('  chance to clear k steps:');
  console.log('   ' + ev.slice(1).map((_, i) => `${i + 1}: ${(survive(i + 1) * 100).toFixed(2)}%`).join('  '));
  for (const id of Object.keys(cfg.side_bets)) {
    const per = [];
    for (let L = 1; L <= levels; L++) { const v = sideRtp(game, mode, id, L); per.push(v == null ? '—' : pct(v)); }
    console.log(`  side ${id.padEnd(14)} ${per.join(' ')}`);
  }
  console.log(`  helmet (L${cfg.helmet.from_level}…${levels})      ${Array.from({ length: levels - cfg.helmet.from_level + 1 }, (_, i) => pct(helmetRtp(game, mode, i + cfg.helmet.from_level))).join(' ')}`);
  const rev = [];
  for (let k = 1; cfg.revenge && k <= levels; k++) {
    // trigger = lethal on a level >= min_level while chasing k
    let t = 0;
    for (let L = cfg.revenge.min_level; L <= k; L++) t += deathAt[L];
    const sess = (ev[k] + t * (boosted[k] - ev[k])) / 1; // each round: bet 1; boosted share = t
    rev.push(`${k}: ${pct(sess)}`);
  }
  if (cfg.revenge) {
    console.log(`  session RTP with Revenge x${cfg.revenge.boost.toFixed(4)} taken every time, chasing k:`);
    console.log('   ' + rev.join('  '));
  }
  console.log('');
  summary[mode] = { main: ev.slice(1) };
}

if (MC > 0) {
  console.log(`Monte-Carlo with the real HMAC hash, ${MC.toLocaleString()} rounds per line (cash out after k):`);
  for (const mode of Object.keys(cfg.modes)) {
    const row = [];
    for (const k of [1, 3, 5]) {
      let ret = 0;
      for (let i = 0; i < MC; i++) {
        const s = { server_seed: sc.newServerSeed(), client_seed: 'mc' };
        const round = { mode, bet: BET, level: 0, multiplier: cfg.rtp, nonce: 0, shot_index: 0 };
        for (;;) {
          const q = sc.quote(game, round, s);
          const h = sc.shotHash(s.server_seed, s.client_seed, 0, round.shot_index++);
          if (sc.outcomeOf(cfg, q.chance, h.u) === 'lethal') break;
          round.level++;
          round.multiplier *= sc.clearFactor(cfg, q.chance, sc.outcomeOf(cfg, q.chance, h.u));
          if (round.level >= k) { ret += sc.payoutOf(BET, round.multiplier, game.max_win_x); break; }
        }
      }
      row.push(`${k}: ${pct(ret / MC / BET)} (exact ${pct(summary[mode].main[k - 1])})`);
    }
    console.log(`  ${cfg.modes[mode].label.padEnd(7)} ${row.join('   ')}`);
  }
}

