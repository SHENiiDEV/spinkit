// Hill Climb Rush — SpinKit Exclusive · step crash over 10 hills (src/engine/exclusive/step-crash.js)
//
// The player drives a vehicle over a track of 10 hills with a checkpoint on every crest. Holding GAS at a
// checkpoint starts the next hill; at that moment the server fixes the hill with the Provably Fair hash
//   HMAC_SHA256(server_seed, `${client_seed}:${nonce}:${hill_index}`)
// bytes 0-3 -> outcome (clear / crash and how), bytes 4-5 -> the terrain seed the client draws the hill from.
// The client's driving physics follows that outcome: the pedals change speed and pitch, not the result.
//
// Math (exact, strategy-independent): multiplier after k hills = rtp / chance_1 / … / chance_k, so the main
// line returns `rtp` for any cash-out point. Vehicles are the volatility selector (Low / Medium / High).
//
// A crash is a flip (Neck Snap) or an empty tank (shares of the lethal part of the same hash float).
// Jerrycan: per-hill buy, saves only an empty tank — the round keeps 70% of its multiplier and drives
// the same hill again. Price = P(fuel crash) x 0.7 x multiplier x bet / 0.965.
// Trick bets settle on the next hill only, at odds = floor(0.965 / P) from that hill's chance.

module.exports = {
  id: 'hill_climb',
  name: 'Hill Climb Rush',
  tagline: 'Two-pedal step crash · 10 hills · Trick bets · Jerrycan · Provably Fair',
  category: 'exclusive',
  kind: 'exclusive',
  client: 'hill_climb', // public/games/hill_climb/index.html
  mechanic: 'step_crash',
  reels_count: 1,
  rows_count: 10, // hills
  bet_multiplier: 20,
  volatility: 'low / medium / high',
  max_win_x: 5000,
  // bet ladder $0.20 … $5,000; players get up to $100 until the operator raises max_bet
  coin_values: [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1250, 2500, 3750, 5000, 7500, 10000, 12500, 25000],
  default_max_bet: 10000,
  operator_options: {
    helmet_max_saves: { label: 'Jerrycan saves per round', min: 0, max: 10, default: null, hint: 'empty = unlimited, 0 = jerrycan off' }
  },
  rtp: '96.50%',

  crash: {
    rtp: 0.965,
    // checkpoint distance from the start line, metres (odometer)
    distances: [50, 100, 170, 250, 350, 470, 600, 750, 920, 1200],
    hill_names: ['Village Hill', 'Bumpy Track', 'First Kicker', 'Gravel Slide', '45° Climb', 'Log Bridge', 'Sand Dune', 'Canyon Jump', 'Rocky Cliff', 'Everest'],
    // vehicles = volatility: chance to make each checkpoint
    modes: {
      truck: { label: 'Monster Truck', survival: [0.94, 0.9, 0.86, 0.82, 0.77, 0.72, 0.67, 0.62, 0.57, 0.52] },
      jeep: { label: 'Jeep', survival: [0.92, 0.88, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.4] },
      bike: { label: 'Dirt Bike', survival: [0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4] }
    },
    default_mode: 'jeep',
    // how a cleared hill looks (shares of the chance, in hash order) — trick bets settle on these
    outcomes: { backflip: 0.07, coin_chest: 0.13, big_air: 0.09, fumes: 0.25, clean: 0.46 },
    // how a crash looks (shares of the lethal part)
    crashes: { flip: 0.6, fuel: 0.4 },
    side_bets: {
      backflip: { label: 'Backflip', rtp: 0.965, wins_on: ['backflip'] }, // a clean 360° in the air
      air_time: { label: 'Air Time', rtp: 0.965, wins_on: ['big_air', 'backflip'] }, // more than 2.5 s in the air
      coin_chest: { label: 'Coin Chest', rtp: 0.965, wins_on: ['coin_chest'] }, // smash the chest over the gap
      empty_tank: { label: 'Empty Tank Hero', rtp: 0.965, wins_on: ['fumes'] }, // make the checkpoint on < 3 units
      rollcage: { label: 'Rollcage Insurance', rtp: 0.965, wins_on: ['flip'] } // pays when the vehicle flips
    },
    // Jerrycan: covers only an empty tank, keeps 70% of the multiplier, same hill again
    helmet: { from_level: 2, keep: 0.7, covers: ['fuel'], rtp: 0.965, label: 'Jerrycan' },
    skins: [
      { id: 'classic', name: "Bill's Red", shots: 0 },
      { id: 'desert', name: 'Desert Sand', shots: 100 },
      { id: 'arctic', name: 'Arctic White', shots: 200 },
      { id: 'neon', name: 'Neon Night', shots: 300 },
      { id: 'gold', name: 'Gold Rush', shots: 400 }
    ]
  },

  theme: { accent: '#ffb000', bg1: '#58b7ff', bg2: '#1d5a1f', title: ['HILL CLIMB', 'RUSH'], icon: '🚙', font: 'Russo One' },
  symbols: {},
  paytable: {}
};
