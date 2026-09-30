const { weightedTable } = require('../rng');
const { spinReels } = require('../core/reels');
const { evaluatePaylines, totalPayout } = require('../core/evaluate');
const { buildReelStrips } = require('./lines');

/**
 * "Hold & Win" mechanic — paylines + money coins + respin bonus with fixed jackpots.
 * Reusable for any lines game:
 *
 *   mechanic: 'holdwin'
 *   paylines, paytable, reels (strips contain COIN)          base game = classic lines (COIN does not pay on lines)
 *   holdwin: {
 *     trigger: 6,                                            coins on screen to start the bonus
 *     respins: 3,                                            respins; reset every time a new coin lands
 *     land_chance: 900,                                      per empty cell per respin, out of 10,000
 *     values: { 1: 300, 2: 220, ... },                       coin values (x total bet) with weights
 *     jackpots: { MINI: 25, MINOR: 50, MAJOR: 250, GRAND: 1000 },   x total bet; GRAND = every cell filled
 *     jackpot_weights: { MINI: 6, MINOR: 3, MAJOR: 1 },      jackpot coins among coin draws (same scale as values)
 *     specials: { COLLECT: 8, BOOST: 4 }                     bonus-only coins (weights, same scale)
 *   }
 *
 * Coin kinds:  { v: 5 }            money coin, pays v x bet
 *              { v: 25, jp: 'MINI' }  jackpot coin
 *              COLLECT             lands and adds the value of every coin on screen to itself
 *              BOOST               lands and doubles the value of every coin on screen
 * The bonus plays out entirely inside the triggering spin (steps are returned for the animation).
 * Coin values are scaled by game.coin_scale (the calibration pay_scale), like the paytable.
 */

function coinTables(game) {
  const h = game.holdwin;
  const base = {};
  for (const [v, w] of Object.entries(h.values)) base[`v${v}`] = w;
  for (const [jp, w] of Object.entries(h.jackpot_weights || {})) base[`j${jp}`] = w;
  const bonus = { ...base };
  for (const [sp, w] of Object.entries(h.specials || {})) bonus[`s${sp}`] = w;
  return { base: weightedTable(base), bonus: weightedTable(bonus) };
}

function makeCoin(game, key, scale) {
  const h = game.holdwin;
  if (key[0] === 'v') return { v: round(Number(key.slice(1)) * scale) };
  if (key[0] === 'j') return { v: round(h.jackpots[key.slice(1)] * scale), jp: key.slice(1) };
  return { v: 0, special: key.slice(1) };
}

const round = (x) => Math.round(x * 100) / 100;

function play(game, { bet, rng, forceTrigger = false, customStops = null }) {
  const h = game.holdwin;
  const scale = game.coin_scale || 1;
  const rows = game.rows_count;
  const cols = game.reels_count;
  const T = coinTables(game);
  const { matrix, stops } = spinReels(game.reel_strips, rows, rng, { customStops });

  if (forceTrigger) {
    // feature buy: make sure exactly `trigger` coins are on screen
    let have = matrix.flat().filter((s) => s === 'COIN').length;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (matrix[r][c] !== 'COIN') cells.push([r, c]);
    while (have < h.trigger && cells.length) {
      const [r, c] = cells.splice(rng.int(cells.length), 1)[0];
      matrix[r][c] = 'COIN';
      have++;
    }
  }

  // values of the coins on the base screen
  const coins = {};
  matrix.forEach((row, r) => row.forEach((s, c) => { if (s === 'COIN') coins[`${r},${c}`] = makeCoin(game, T.base.pick(rng), scale); }));
  const coinCount = Object.keys(coins).length;

  const winning_lines = evaluatePaylines(game, matrix, bet);
  let win = totalPayout(winning_lines);

  let holdwin = null;
  if (coinCount >= h.trigger) {
    holdwin = playBonus(game, coins, rng, T, scale, bet);
    win += holdwin.payout;
  }

  return {
    matrix,
    stop_positions: stops,
    winning_lines,
    scatter_win: null,
    coins,
    holdwin,
    win,
    free_spins_awarded: 0
  };
}

function playBonus(game, startCoins, rng, T, scale, bet) {
  const h = game.holdwin;
  const rows = game.rows_count;
  const cols = game.reels_count;
  const total = rows * cols;
  const grid = { ...startCoins };
  let left = h.respins;
  const steps = [];
  const cap = 200;
  for (let n = 0; n < cap && left > 0 && Object.keys(grid).length < total; n++) {
    const landed = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${r},${c}`;
        if (grid[k] || rng.int(10000) >= h.land_chance) continue;
        landed[k] = makeCoin(game, T.bonus.pick(rng), scale);
      }
    }
    const events = [];
    // plain coins first, then specials in reading order
    for (const [k, coin] of Object.entries(landed)) if (!coin.special) grid[k] = coin;
    for (const [k, coin] of Object.entries(landed)) {
      if (!coin.special) continue;
      if (coin.special === 'COLLECT') {
        const sum = round(Object.values(grid).reduce((s, x) => s + x.v, 0));
        grid[k] = { v: sum, special: 'COLLECT' };
        events.push({ type: 'collect', at: k, value: sum });
      } else if (coin.special === 'BOOST') {
        for (const kk of Object.keys(grid)) grid[kk] = { ...grid[kk], v: round(grid[kk].v * 2) };
        grid[k] = { v: 0, special: 'BOOST' };
        events.push({ type: 'boost', at: k, factor: 2 });
      }
    }
    left = Object.keys(landed).length ? h.respins : left - 1;
    steps.push({ landed, events, grid: JSON.parse(JSON.stringify(grid)), respins_left: left });
  }
  const full = Object.keys(grid).length >= total;
  const coinSum = round(Object.values(grid).reduce((s, x) => s + x.v, 0));
  const grand = full ? round(h.jackpots.GRAND * scale) : 0;
  const payoutX = coinSum + grand;
  return {
    start: startCoins,
    steps,
    grid,
    full,
    coin_sum_x: coinSum,
    grand_x: grand,
    payout_x: payoutX,
    payout: Math.floor(bet * payoutX)
  };
}

const round2 = (x, scale) => Math.round(x * scale * 100) / 100;

module.exports = {
  id: 'holdwin',
  label: 'Hold & Win',
  paytableUnit: 'x line bet (coins: x total bet)',
  build(game, raw, ctx) {
    game.coin_scale = ctx.scale; // coin values scale with the paytable
    buildReelStrips(game, raw, ctx);
  },
  play,
  publicConfig: (game) => {
    const h = game.holdwin;
    const scale = game.coin_scale || 1;
    return {
      holdwin: {
        trigger: h.trigger,
        respins: h.respins,
        jackpot_names: h.jackpot_names || null,
        jackpots: Object.fromEntries(Object.entries(h.jackpots).map(([k, v]) => [k, round2(v, scale)])),
        specials: Object.keys(h.specials || {}),
        values: Object.keys(h.values).map((v) => round2(Number(v), scale))
      }
    };
  },
  features: (game) => ({
    hold_and_win: { trigger: game.holdwin.trigger, respins: game.holdwin.respins, jackpots: game.holdwin.jackpot_names || Object.keys(game.holdwin.jackpots) }
  }),
  playBonus
};
