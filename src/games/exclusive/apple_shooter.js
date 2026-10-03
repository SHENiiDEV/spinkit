// Apple Shooter — SpinKit Exclusive · step crash (src/engine/exclusive/step-crash.js)
//
// Not a slot: a round is a ladder of up to 10 arrow shots at an apple on your partner's head.
// Every cleared shot raises the multiplier, CASH OUT is allowed after any cleared shot,
// a lethal shot ends the round. Each shot is decided by the Provably Fair hash
// HMAC_SHA256(server_seed, `${client_seed}:${nonce}:${shot_index}`): bytes 0-3 -> outcome, bytes 4-5 -> wind.
//
// Math (exact, strategy-independent):
//   chance(level, wind)  = survival[mode][level] / (1 + wind.bonus)
//   multiplier after k   = rtp / chance_1 / chance_2 / ... / chance_k
// Only the first shot carries the house edge; every further shot is EV-neutral, so the main
// line returns exactly `rtp` whatever the player's cash-out strategy. Wind raises the step
// (+5 / +15 / +35 %) and lowers the chance by the same factor — it changes volatility, not RTP.
//
// The helmet is a per-shot buy priced at P(lethal) x (keep x current multiplier x bet) / helmet_rtp.

module.exports = {
  id: 'apple_shooter',
  name: 'Apple Shooter',
  tagline: 'Retro step crash · 10 shots · Wind · Steel Helmet · Provably Fair',
  category: 'exclusive',
  kind: 'exclusive', // stateful round game: played through POST /api/v1/rgs/action, not /rgs/spin
  client: 'apple_shooter', // public/games/apple_shooter/index.html
  mechanic: 'step_crash',
  reels_count: 1, // shown as "1x10" in the merchant API (one ladder of 10 shots)
  rows_count: 10,
  bet_multiplier: 20, // same bet ladder as 20-line slots: 0.20 … 100.00
  volatility: 'medium / high',
  max_win_x: 5000,
  // wider bet ladder ($0.20 … $5,000); players get up to $100 until the operator raises max_bet
  coin_values: [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1250, 2500, 3750, 5000, 7500, 10000, 12500, 25000],
  default_max_bet: 10000,
  // settings the operator can change per game (merchant_games.options)
  operator_options: {
    helmet_max_saves: { label: 'Steel Helmet saves per round', min: 0, max: 10, default: null, hint: 'empty = unlimited, 0 = helmet off' }
  },
  rtp: '96.50%',

  crash: {
    rtp: 0.965,
    // distance to the partner per level, metres (client draws the field from it)
    distances: [8, 11, 14, 17, 20, 24, 28, 32, 37, 42],
    modes: {
      medium: { label: 'Medium', survival: [0.91, 0.89, 0.87, 0.85, 0.82, 0.79, 0.76, 0.73, 0.7, 0.66] },
      high: { label: 'High', survival: [0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.56, 0.52, 0.48, 0.44] }
    },
    default_mode: 'medium',
    // |wind| in m/s -> tier; bonus raises the step and lowers the chance by the same factor
    wind: [
      { id: 'calm', label: 'Dead Calm', max: 1.0, bonus: 0 },
      { id: 'breeze', label: 'Breeze', max: 4.0, bonus: 0.05 },
      { id: 'crosswind', label: 'Crosswind', max: 7.5, bonus: 0.15 },
      { id: 'storm', label: 'Storm Gale', max: Infinity, bonus: 0.35 }
    ],
    // how a survived shot looks (shares of the survival chance, in hash order)
    outcomes: { bullseye: 0.07, hat_trick: 0.24, near_miss: 0.32, hit: 0.37 },
    // no side bets: the only extra is the Steel Helmet (per-shot save)
    side_bets: {},
    helmet: { from_level: 2, keep: 0.5, rtp: 0.965 },
    // after a lethal shot on level 7+ the next round (within 60 s, bet <= that round's bet)
    // starts with a boosted first step: x1.10 instead of x1.06 on Medium (whole ladder x1.0377).
    // It is a gift on top of the RTP: worst case (always chasing level 10) +0.55 pp on Medium.
    // The GDD's x1.30 (boost 1.3 / 1.06) would give such a player 99.7% — see scripts/simulate-exclusive.js.
    revenge: { min_level: 7, window_sec: 60, boost: 1.1 / 1.06 },
    skins: [
      { id: 'classic', name: 'Classic Flash', shots: 0 },
      { id: 'robin', name: 'Robin Hood', shots: 100 },
      { id: 'cyber', name: 'Cyber Sniper', shots: 200 },
      { id: 'office', name: 'Office Hero', shots: 300 },
      { id: 'shiba', name: 'Pizza Shiba', shots: 400 }
    ]
  },

  theme: {
    accent: '#ff3b3b', bg1: '#2b6cff', bg2: '#0b1a3a', title: ['APPLE', 'SHOOTER'], icon: '🍎', font: 'Press Start 2P'
    // lobby thumbnail: public/games/apple_shooter/assets/thumb.jpg (picked up by catalog.js)
  },
  symbols: {},
  paytable: {}
};
