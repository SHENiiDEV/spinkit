/**
 * Mechanic registry — the single place that knows which mechanics exist.
 *
 * A mechanic is a plain module that exports a descriptor:
 *
 *   {
 *     id: 'lines',                        value of `mechanic` in a game definition
 *     label: 'Paylines',                  human name (docs, back office)
 *     paytableUnit: 'x line bet',         what the paytable numbers mean (merchant API)
 *     waysCount?: (raw) => number,        "ways" shown to players (ways games only)
 *     build(game, raw, { seed, scale }),  precomputes what play() needs (reel strips, weights, ...)
 *     play(game, { bet, rng, inFreeSpins, forceTrigger, customStops, bonus }) -> spin result
 *     publicConfig?: (game) => ({...}),   mechanic-specific fields of the client game config
 *     publicFreeSpins?: (game) => ({...}),mechanic-specific fields of config.free_spins
 *     features?: (game) => ({...})        feature flags for the merchant API game list
 *   }
 *
 * Adding a mechanic = one file in this folder + one line in MECHANICS below.
 * The defaults below keep every API field present (null / false) for every game,
 * so clients never have to check which mechanic produced a response.
 */
const MECHANICS = Object.fromEntries(
  ['lines', 'ways', 'tumble', 'giants', 'clusters', 'megaways', 'holdwin', 'matchlines', 'step_crash', 'lane_slash']
    .map((id) => [id, require(`./${id}`)])
);

/** Mechanic-specific keys of the public game config (client + merchant API). */
const PUBLIC_DEFAULTS = {
  giants: null,
  spots: null,
  win_multiplier_rules: null,
  min_line: null,
  holdwin: null,
  min_cluster: null,
  multipliers: null
};

/** Mechanic-specific keys of the public free-spins config. */
const FREE_SPINS_DEFAULTS = {
  sticky_multipliers: null,
  sticky_multipliers_by_symbol: null
};

/** Feature flags of the merchant API game summary. */
const FEATURE_DEFAULTS = {
  tumble: false,
  cluster_pays: false,
  megaways: false,
  hold_and_win: null,
  cascades: false,
  win_multiplier: null,
  multiplier_spots: null,
  giant_symbols: null
};

/** Optional spin-result fields a mechanic may return; missing ones are sent as null. */
const RESULT_KEYS = ['cascades', 'multipliers', 'wild_multipliers', 'giants', 'spots', 'heights', 'ways', 'reels', 'final_reels', 'win_multiplier', 'coins', 'holdwin'];

function getMechanic(id) {
  const m = MECHANICS[id];
  if (!m) throw new Error(`Unknown mechanic "${id}". Known: ${Object.keys(MECHANICS).join(', ')}`);
  return m;
}

const publicConfig = (game) => ({ ...PUBLIC_DEFAULTS, ...(getMechanic(game.mechanic).publicConfig || (() => ({})))(game) });
const publicFreeSpins = (game) => ({ ...FREE_SPINS_DEFAULTS, ...(getMechanic(game.mechanic).publicFreeSpins || (() => ({})))(game) });
const features = (game) => ({ ...FEATURE_DEFAULTS, ...(getMechanic(game.mechanic).features || (() => ({})))(game) });

module.exports = { MECHANICS, RESULT_KEYS, getMechanic, publicConfig, publicFreeSpins, features };
