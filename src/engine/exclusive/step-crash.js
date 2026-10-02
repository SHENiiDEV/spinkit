/**
 * Step crash — the math of SpinKit Exclusive ladder games (first one: Apple Shooter).
 *
 * A round is a ladder of shots. Before each shot the server publishes the wind of that shot
 * (derived from the same Provably Fair hash as the outcome) and the chance to clear it:
 *
 *   hash(shot)  = HMAC_SHA256(key = server_seed, msg = `${client_seed}:${nonce}:${shot_index}`)
 *   u           = uint32(hash[0..3]) / 2^32                  -> outcome
 *   wind (m/s)  = uint16(hash[4..5]) / 65535 * 20 - 10        -> rounded to 0.1, sign = direction
 *   chance      = survival[mode][level] / (1 + tier(|wind|).bonus)
 *   u >= chance -> LETHAL; otherwise u / chance falls into bullseye | hat_trick | near_miss | hit
 *
 *   multiplier  = rtp x boost / chance_1 / ... / chance_k      (boost = Revenge, else 1)
 *
 * The first shot has EV = rtp x bet, every later shot is EV-neutral (chance x step = 1),
 * so the main line pays exactly rtp for ANY cash-out strategy. The ladder multiplier is shown and
 * paid rounded to the nearest 0.01 (unbiased); side-bet odds are rounded down; cash is floored to minor units.
 *
 * Pure functions only: no database, no wallet. src/services/exclusive-service.js owns the state.
 */
const crypto = require('node:crypto');

const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100; // side-bet odds: always rounded down
const round2 = (x) => Math.round(x * 100) / 100; // displayed / paid ladder multiplier: nearest 0.01 (unbiased)

// ------------------------------------------------------------------ provably fair
function newServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}
function newClientSeed() {
  return crypto.randomBytes(8).toString('hex');
}
function hashSeed(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

/** The fair hash of one shot: { hex, u, wind }. */
function shotHash(serverSeed, clientSeed, nonce, shotIndex) {
  const h = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${shotIndex}`).digest();
  const u = h.readUInt32BE(0) / 4294967296;
  const wind = Math.round((h.readUInt16BE(4) / 65535 * 20 - 10) * 10) / 10 + 0; // + 0: no -0
  return { hex: h.toString('hex'), u, wind };
}

// ------------------------------------------------------------------ math
function cfgOf(game) {
  return game.crash;
}

function windTier(cfg, wind) {
  const a = Math.abs(wind);
  return cfg.wind.find((t) => a <= t.max) || cfg.wind[cfg.wind.length - 1];
}

function chanceOf(cfg, mode, level, tier) {
  const surv = cfg.modes[mode].survival;
  return surv[level - 1] / (1 + tier.bonus);
}

/** Outcome of a shot from its hash float. */
function outcomeOf(cfg, chance, u) {
  if (u >= chance) return 'lethal';
  const x = u / chance;
  let acc = 0;
  for (const [id, share] of Object.entries(cfg.outcomes)) {
    acc += share;
    if (x < acc) return id;
  }
  return 'hit';
}

/** Probability of each outcome for a shot with the given chance. */
function outcomeProbs(cfg, chance) {
  const p = { lethal: 1 - chance };
  for (const [id, share] of Object.entries(cfg.outcomes)) p[id] = chance * share;
  return p;
}

/** Side-bet odds for the next shot ({ id: odds | null when not offered }). */
function sideOdds(cfg, chance, wind) {
  const probs = outcomeProbs(cfg, chance);
  const out = {};
  for (const [id, sb] of Object.entries(cfg.side_bets)) {
    if (sb.min_wind && Math.abs(wind) < sb.min_wind) { out[id] = null; continue; }
    const q = sb.wins_on.reduce((s, o) => s + (probs[o] || 0), 0);
    const odds = q > 0 ? floor2(sb.rtp / q) : 0;
    out[id] = odds >= 1.05 ? odds : null;
  }
  return out;
}

/** Cash value of a multiplier for a bet (minor units, rounded down). */
function payoutOf(bet, multiplier, maxWinX) {
  const m100 = Math.round(multiplier * 100);
  const pay = Math.floor((bet * m100) / 100);
  return maxWinX ? Math.min(pay, bet * maxWinX) : pay;
}

/** Fair helmet price for the next shot: keeps `keep` x current multiplier if the shot is lethal. */
function helmetPrice(cfg, round, chance) {
  const h = cfg.helmet;
  if (!h || round.level + 1 < h.from_level) return null;
  return Math.max(1, Math.ceil((round.bet * h.keep * round.multiplier * (1 - chance)) / h.rtp));
}

/**
 * What the player sees before the next shot of a round:
 * level, wind, chance, the multiplier after a clear, side-bet odds, helmet price.
 */
function quote(game, round, seeds) {
  const cfg = cfgOf(game);
  const level = round.level + 1;
  const { wind } = shotHash(seeds.server_seed, seeds.client_seed, round.nonce, round.shot_index);
  const tier = windTier(cfg, wind);
  const chance = chanceOf(cfg, round.mode, level, tier);
  const next = round.multiplier / chance;
  return {
    level,
    shot_index: round.shot_index,
    distance_m: cfg.distances[level - 1],
    wind,
    wind_tier: tier.id,
    wind_label: tier.label,
    wind_bonus: tier.bonus,
    chance,
    multiplier: round2(next),
    payout: payoutOf(round.bet, next, game.max_win_x),
    side_bets: sideOdds(cfg, chance, wind),
    helmet_price: helmetPrice(cfg, round, chance)
  };
}

/** Multipliers of a calm ladder (no wind) for the paytable / lobby. */
function ladder(game, mode, boost = 1) {
  const cfg = cfgOf(game);
  let m = cfg.rtp * boost;
  return cfg.modes[mode].survival.map((p) => round2((m /= p)));
}

// ------------------------------------------------------------------ mechanic descriptor
/**
 * Registered in src/engine/mechanics so the catalog, merchant API and back office treat the
 * game like any other; `stateful: true` routes play through the action API instead of /rgs/spin.
 */
const mechanic = {
  id: 'step_crash',
  label: 'Step Crash (SpinKit Exclusive)',
  paytableUnit: 'x bet (cash-out multiplier)',
  stateful: true,
  build(game, raw, { scale = 1 } = {}) {
    // RTP profiles (88 / 94 / … / QA) scale the target RTP, like pay_scale does for slots
    const base = raw.crash;
    game.crash = { ...base, rtp: base.rtp * scale };
    game.rtp = `${(game.crash.rtp * 100).toFixed(2)}%`;
    game.hit_rate = null;
  },
  play() {
    throw new Error('step_crash is a stateful game: use POST /api/v1/rgs/action');
  },
  publicConfig: (game) => {
    const c = game.crash;
    return {
      crash: {
        rtp: c.rtp,
        levels: c.distances.length,
        distances: c.distances,
        modes: Object.fromEntries(Object.entries(c.modes).map(([id, m]) => [id, { label: m.label, survival: m.survival, ladder: ladder(game, id) }])),
        default_mode: c.default_mode,
        wind: c.wind.map((t) => ({ ...t, max: Number.isFinite(t.max) ? t.max : null })),
        outcomes: c.outcomes,
        side_bets: Object.fromEntries(Object.entries(c.side_bets).map(([id, s]) => [id, { label: s.label, rtp: s.rtp, wins_on: s.wins_on, min_wind: s.min_wind || null }])),
        helmet: c.helmet,
        revenge: c.revenge,
        skins: c.skins
      }
    };
  },
  features: () => ({ step_crash: true, provably_fair: true, side_bets: true })
};

module.exports = {
  mechanic, floor2, round2, newServerSeed, newClientSeed, hashSeed, shotHash,
  windTier, chanceOf, outcomeOf, outcomeProbs, sideOdds, payoutOf, helmetPrice, quote, ladder
};
