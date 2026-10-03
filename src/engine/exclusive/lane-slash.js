/**
 * Lane slash — math of Fruit Slash (SpinKit Exclusive).
 *
 * The field has L lanes. Before a wave the player COMMITS a cut: a contiguous span of k lanes.
 * Only then the server derives the wave from the Provably Fair hash and resolves it:
 *
 *   hash(wave)  = HMAC_SHA256(server_seed, `${client_seed}:${nonce}:${wave_index}`)
 *   lanes       = Fisher-Yates shuffle of [fruit x n, bomb x b, empty x e] with hash words 0..6
 *   dragon      = word 7 / 2^32 < dragon_chance  → the lowest-index fruit lane holds a dragon fruit
 *
 *   bomb in the cut          → BOOM, the round is lost (a Samurai Shield can absorb it once)
 *   no fruit in the cut      → MISS, the round is lost
 *   f fruits cut, no bomb    → multiplier x g(f) / Z(k),  g(f) = 1 + step x (f - 1)
 *
 * Z(k) = Σ_f P(f fruits, no bomb | k) x g(f), so the expected factor of every wave is exactly 1
 * whatever span the player picks: lane positions are unknown when the cut is committed, so every
 * span of the same width has the same odds, and the width only trades risk against reward.
 * The first wave starts from rtp, so the main bet returns rtp for any cutting and cash-out strategy.
 *
 * A width is offered only while its best result stays within the max win; when no width is left
 * the round is cashed out at the current multiplier (EV-neutral), so the cap never cuts a payout.
 *
 * Nothing about a wave is revealed before its cut is stored: the quote depends on the wave number and
 * the width only. After a seed rotation the player recomputes every wave from the revealed seed.
 */
const sc = require('./step-crash');

const comb = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

const levelsOf = (cfg) => Object.values(cfg.modes)[0].waves.length;
const waveOf = (cfg, mode, level) => {
  const w = cfg.modes[mode].waves[level - 1];
  return { n: w[0], b: w[1], e: cfg.lanes - w[0] - w[1] };
};
const g = (cfg, f) => 1 + cfg.fruit_step * (f - 1);

/** Exact odds of a span of k lanes on a wave. */
function spanStats(cfg, w, k) {
  const L = cfg.lanes;
  const all = comb(L, k);
  const pf = [];
  let win = 0;
  let Z = 0;
  for (let f = 1; f <= Math.min(k, w.n); f++) {
    const p = (comb(w.n, f) * comb(w.e, k - f)) / all;
    pf[f] = p;
    win += p;
    Z += p * g(cfg, f);
  }
  const bomb = 1 - comb(L - w.b, k) / all;
  const combo = pf.reduce((s, p, f) => s + (f >= cfg.combo_min ? p || 0 : 0), 0);
  const clean = k >= w.n ? pf[w.n] || 0 : 0;
  const dragon = cfg.dragon_chance * pf.reduce((s, p, f) => s + (p || 0) * (f / w.n), 0);
  return { k, win, Z, pf, bomb, empty: 1 - win - bomb, combo, clean, dragon };
}

function sideOddsFor(cfg, s) {
  const P = { mega_combo: s.combo, clean_sheet: s.clean, dragon_fruit: s.dragon, insurance: s.bomb };
  const out = {};
  for (const [id, sb] of Object.entries(cfg.side_bets)) {
    const p = P[id] || 0;
    const odds = p > 0 ? sc.floor2(sb.rtp / p) : 0;
    out[id] = odds >= 1.05 ? odds : null;
  }
  return out;
}

function shieldPrice(cfg, round, s) {
  const h = cfg.helmet;
  if (!h || round.level + 1 < h.from_level || !round.prev_multiplier) return null;
  if (h.max_saves && (round.saves || 0) >= h.max_saves) return null;
  if (s.bomb <= 0) return null;
  return Math.max(1, Math.ceil((round.bet * round.prev_multiplier * s.bomb) / h.rtp));
}

/** The wave a hash describes: lanes ('F' | 'B' | '-') and the dragon lane (or -1). */
function waveFromHash(cfg, w, hex) {
  const h = Buffer.from(hex, 'hex');
  const lanes = [...'F'.repeat(w.n), ...'B'.repeat(w.b), ...'-'.repeat(w.e)];
  for (let i = cfg.lanes - 1, word = 0; i >= 1; i--, word++) {
    const j = Math.floor((h.readUInt32BE(word * 4) / 4294967296) * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  const dragon = h.readUInt32BE(28) / 4294967296 < cfg.dragon_chance ? lanes.indexOf('F') : -1;
  return { lanes, dragon };
}

/** Before a wave: everything that depends on the width, nothing that depends on the hash. */
function quote(game, round) {
  const cfg = game.crash;
  const level = round.level + 1;
  const w = waveOf(cfg, round.mode, level);
  const spans = [];
  for (let k = 1; k <= cfg.lanes; k++) {
    const s = spanStats(cfg, w, k);
    const fMax = Math.min(k, w.n);
    // a width is offered only when it can win, a single fruit never lowers the multiplier, and its best
    // result stays within the max win (so the cap never cuts a payout and every wave stays EV-neutral)
    const top = round.multiplier * g(cfg, fMax) / s.Z;
    if (s.win <= 0 || 1 / s.Z < 1 || (game.max_win_x && top > game.max_win_x)) { spans.push({ k, playable: false }); continue; }
    spans.push({
      k,
      playable: true,
      chance: s.win,
      bomb_chance: s.bomb,
      empty_chance: s.empty,
      multipliers: Array.from({ length: fMax }, (_, i) => sc.round2(round.multiplier * g(cfg, i + 1) / s.Z)),
      side_bets: sideOddsFor(cfg, s),
      helmet_price: shieldPrice(cfg, round, s)
    });
  }
  return { level, shot_index: round.shot_index, lanes: cfg.lanes, fruits: w.n, bombs: w.b, empties: w.e, spans, max_width: spans.filter((x) => x.playable).length };
}

/** Reads and validates the committed cut: { from, to } lane indexes (0-based, inclusive). */
function prepare(game, round, q, body) {
  const cfg = game.crash;
  const c = body.cut || {};
  const from = Number(c.from);
  const to = Number(c.to);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to >= cfg.lanes || to < from) {
    const e = new Error(`cut must be { from, to } lanes 0…${cfg.lanes - 1}`);
    e.code = 'INVALID_CUT';
    throw e;
  }
  const span = q.spans[to - from];
  if (!span.playable) {
    const e = new Error('This cut is too wide for this wave');
    e.code = 'INVALID_CUT';
    throw e;
  }
  return { input: { from, to, k: to - from + 1 }, odds: span.side_bets, helmetPrice: span.helmet_price, chance: span.chance };
}

/** Resolves the committed cut against the fair wave. */
function resolve(game, round, seeds, q, input) {
  const cfg = game.crash;
  const h = sc.shotHash(seeds.server_seed, seeds.client_seed, round.nonce, round.shot_index);
  const w = waveOf(cfg, round.mode, q.level);
  const wave = waveFromHash(cfg, w, h.hex);
  const cut = wave.lanes.slice(input.from, input.to + 1);
  const bombs = cut.filter((x) => x === 'B').length;
  const fruits = cut.filter((x) => x === 'F').length;
  const dragonCut = wave.dragon >= input.from && wave.dragon <= input.to;
  const s = spanStats(cfg, w, input.k);
  const outcome = bombs ? 'bomb' : fruits ? 'cut' : 'empty';
  const events = [];
  if (bombs) events.push('insurance');
  else if (fruits) {
    if (fruits >= cfg.combo_min) events.push('mega_combo');
    if (fruits === w.n) events.push('clean_sheet');
    if (dragonCut) events.push('dragon_fruit');
  }
  return {
    outcome,
    survive: outcome === 'cut',
    saveable: outcome === 'bomb',
    factor: outcome === 'cut' ? g(cfg, fruits) / s.Z : 0,
    events,
    record: { cut: { from: input.from, to: input.to }, lanes: wave.lanes.join(''), dragon: wave.dragon, fruits_cut: fruits, bombs_hit: bombs, chance: s.win, hash: h.hex }
  };
}

const mechanic = {
  id: 'lane_slash',
  label: 'Lane Slash (SpinKit Exclusive)',
  paytableUnit: 'x bet (cash-out multiplier)',
  stateful: true,
  build(game, raw, { scale = 1 } = {}) {
    game.crash = { ...raw.crash, rtp: raw.crash.rtp * scale };
    game.rtp = `${(game.crash.rtp * 100).toFixed(2)}%`;
    game.hit_rate = null;
  },
  play() {
    throw new Error('lane_slash is a stateful game: use POST /api/v1/rgs/action');
  },
  publicConfig: (game) => {
    const c = game.crash;
    return {
      crash: {
        kind: 'lane_slash',
        rtp: c.rtp,
        levels: levelsOf(c),
        lanes: c.lanes,
        fruit_step: c.fruit_step,
        combo_min: c.combo_min,
        dragon_chance: c.dragon_chance,
        wave_names: c.wave_names,
        modes: Object.fromEntries(Object.entries(c.modes).map(([id, m]) => [id, { label: m.label, waves: m.waves }])),
        default_mode: c.default_mode,
        side_bets: Object.fromEntries(Object.entries(c.side_bets).map(([id, s]) => [id, { label: s.label, rtp: s.rtp }])),
        helmet: c.helmet,
        skins: c.skins
      }
    };
  },
  features: () => ({ step_crash: true, provably_fair: true, side_bets: true, player_choice: 'cut width' })
};

module.exports = { mechanic, comb, levelsOf, waveOf, spanStats, sideOddsFor, waveFromHash, quote, prepare, resolve };
