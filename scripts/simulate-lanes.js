#!/usr/bin/env node
/**
 * RTP report for lane-slash games (Fruit Slash): the player commits a cut of k lanes before each wave.
 *
 *   node scripts/simulate-lanes.js                 # exact odds per wave and width, exact RTP by strategy
 *
 * Every wave is EV-neutral by construction (multiplier x g(f) / Z(k)), so without rounding the main bet
 * returns exactly rtp for any widths and cash-out point; the exact enumeration below includes rounding
 * the multiplier to 0.01 and the max-win cap. Side bets are exact (odds rounded down).
 */
const { buildGame } = require('../src/games/build');
const EXCLUSIVE = require('../src/games/exclusive');
const sc = require('../src/engine/exclusive/step-crash');
const ls = require('../src/engine/exclusive/lane-slash');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const game = buildGame(EXCLUSIVE.find((g) => g.id === arg('game', 'fruit_slash')));
const cfg = game.crash;
const pct = (v) => (v * 100).toFixed(2) + '%';
const BET = 10000;

console.log(`${game.name} — lane slash report (target ${pct(cfg.rtp)}), ${cfg.lanes} lanes`);
for (const mode of Object.keys(cfg.modes)) {
  console.log(`\n== ${cfg.modes[mode].label}`);
  cfg.modes[mode].waves.forEach((_, i) => {
    const w = ls.waveOf(cfg, mode, i + 1);
    const cells = [];
    for (let k = 1; k <= 5; k++) {
      const s = ls.spanStats(cfg, w, k);
      if (s.win <= 0 || 1 / s.Z < 1) { cells.push(`k${k} —`); continue; }
      const fMax = Math.min(k, w.n);
      cells.push(`k${k} ${pct(s.win).padStart(6)} x${(1 / s.Z).toFixed(2)}${fMax > 1 ? `…x${((1 + cfg.fruit_step * (fMax - 1)) / s.Z).toFixed(2)}` : ''}`);
    }
    console.log(`  W${String(i + 1).padEnd(2)} ${w.n}F ${w.b}B ${w.e}E   ${cells.join('  |  ')}`);
  });
  // side bets, exact, averaged over widths 1..4
  const side = {};
  for (const id of Object.keys(cfg.side_bets)) {
    let lo = 1, hi = 0;
    cfg.modes[mode].waves.forEach((_, i) => {
      const w = ls.waveOf(cfg, mode, i + 1);
      for (let k = 1; k <= cfg.lanes; k++) {
        const s = ls.spanStats(cfg, w, k);
        if (s.win <= 0) continue;
        const odds = ls.sideOddsFor(cfg, s)[id];
        if (!odds) continue;
        const p = { mega_combo: s.combo, clean_sheet: s.clean, dragon_fruit: s.dragon, insurance: s.bomb }[id];
        const r = odds * p;
        lo = Math.min(lo, r); hi = Math.max(hi, r);
      }
    });
    side[id] = `${pct(lo)}–${pct(hi)}`;
  }
  console.log('  side bets RTP (all waves, all widths): ' + Object.entries(side).map(([k, v]) => `${k} ${v}`).join(' · '));
  // exact main-line RTP (rounding and the max-win cap included) for fixed width k, cash out after m waves
  const exact = (k, m) => {
    let ev = 0;
    (function walk(level, mult, prob) {
      if (level === m || (level > 0 && mult >= game.max_win_x)) { ev += prob * sc.payoutOf(BET, mult, game.max_win_x) / BET; return; }
      const w = ls.waveOf(cfg, mode, level + 1);
      const q = ls.quote(game, { mode, level, multiplier: mult, bet: BET, shot_index: 0 });
      let kk = k;
      while (kk >= 1 && !q.spans[kk - 1].playable) kk--;
      if (kk < 1) { ev += prob * sc.payoutOf(BET, mult, game.max_win_x) / BET; return; } // auto cash-out: nothing left within the max win
      const s = ls.spanStats(cfg, w, kk);
      s.pf.forEach((p, f) => { if (p) walk(level + 1, mult * (1 + cfg.fruit_step * (f - 1)) / s.Z, prob * p); });
    })(0, cfg.rtp, 1);
    return ev;
  };
  const rows = [];
  for (const k of [1, 2, 3]) rows.push(`k${k}: ` + [1, 2, 3, 5, 7, 10].map((m) => `@${m} ${pct(exact(k, m))}`).join(' '));
  console.log('  exact main line, fixed width k, cash out after m waves:');
  rows.forEach((r) => console.log('   ' + r));

}
