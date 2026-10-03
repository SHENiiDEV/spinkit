/**
 * Turns a game definition (src/games/definitions/*.js or a skin) into the runtime game object:
 *   - applies the RTP calibration (calibration.json, written by `npm run simulate -- --calibrate`)
 *   - derives the bet model (bet_multiplier, coin values, bet steps)
 *   - lets the mechanic precompute what it needs (reel strips, weights, ...)
 *
 * Every definition declares:
 *   mechanic        one of src/engine/mechanics (lines, ways, tumble, giants, clusters, megaways, holdwin, matchlines)
 *   grid            reels_count x rows_count
 *   bet_multiplier  total bet = coin value x bet_multiplier (defaults to the payline count, else 20)
 *   symbols         art + metadata for the client renderer
 *   paytable        raw values, multiplied by the calibrated pay_scale and rounded at load time
 *   reels / weights symbol distribution (depends on the mechanic)
 *   free_spins      feature config; buy: true enables Feature Buy (price from calibration)
 *
 * Money is in integer minor units (cents). See src/config.js.
 */
const { getMechanic } = require('../engine/mechanics');
const { COIN_VALUES, DEFAULT_COIN_VALUE } = require('../config');
const CALIBRATION = require('./calibration.json');

function roundPay(v) {
  if (v >= 100) return Math.round(v);
  if (v >= 10) return Math.round(v * 2) / 2;
  return Math.round(v * 100) / 100;
}

function scalePaytable(paytable, scale) {
  const out = {};
  for (const [sym, pays] of Object.entries(paytable)) {
    out[sym] = {};
    for (const [n, v] of Object.entries(pays)) out[sym][n] = roundPay(v * scale);
  }
  return out;
}

/** Twemoji file naming: drop U+FE0F unless the emoji is a ZWJ sequence. */
function toIconFile(glyph) {
  if (!glyph) return null;
  let cps = [...glyph].map((ch) => ch.codePointAt(0).toString(16));
  if (!cps.includes('200d')) cps = cps.filter((cp) => cp !== 'fe0f');
  return cps.join('-') + '.svg';
}

function buildGame(raw, opts = {}) {
  const mechanic = getMechanic(raw.mechanic);
  const cal = CALIBRATION[raw.id] || CALIBRATION[raw.calibration_from] || {};
  const seedKey = raw.calibration_from || raw.id;
  const scale = (cal.pay_scale || raw.pay_scale || 1) * (opts.scaleMult || 1);
  const betMultiplier = raw.bet_multiplier || (raw.paylines ? raw.paylines.length : 20);
  // a game may ship a wider coin ladder (exclusive games: up to $5,000); default_max_bet caps it until the operator raises it
  const coinValues = raw.coin_values || COIN_VALUES;
  const betSteps = coinValues.map((cv) => cv * betMultiplier);
  const defaultMax = raw.default_max_bet && betSteps.includes(raw.default_max_bet) ? raw.default_max_bet : betSteps[betSteps.length - 1];
  const game = {
    ...raw,
    slug: raw.id,
    bet_multiplier: betMultiplier,
    paylines_count: raw.paylines ? raw.paylines.length : null,
    ways_count: mechanic.waysCount ? mechanic.waysCount(raw) : null,
    paytable: scalePaytable(raw.paytable, scale),
    coin_values: coinValues,
    bet_steps: betSteps,
    min_bet: betSteps[0],
    max_bet: defaultMax, // what a player gets with no operator limits
    max_bet_limit: betSteps[betSteps.length - 1], // the highest step an operator can open
    default_bet: DEFAULT_COIN_VALUE * betMultiplier,
    rtp: cal.rtp || raw.rtp || '96.00%',
    hit_rate: cal.hit_rate || null,
    fs_frequency: cal.fs_frequency || null
  };
  if (game.free_spins && game.free_spins.buy) {
    game.free_spins = { ...game.free_spins, buy_cost: cal.buy_cost || raw.free_spins.buy_cost || 100 };
  }
  for (const sym of Object.values(game.symbols)) {
    if (sym.glyph) sym.icon_file = toIconFile(sym.glyph);
    sym.icon = sym.glyph || sym.label; // legacy field used by the hub
  }
  mechanic.build(game, raw, { seed: hash(seedKey), scale });
  Object.defineProperty(game, '_raw', { value: raw, enumerable: false });
  return game;
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

module.exports = { buildGame, toIconFile, scalePaytable, CALIBRATION };
