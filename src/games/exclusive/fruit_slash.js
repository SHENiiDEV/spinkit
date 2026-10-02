// Fruit Slash — SpinKit Exclusive · committed-cut step crash (src/engine/exclusive/lane-slash.js)
//
// Before every wave the player draws the cut across the 8 lanes of the field and commits it.
// Then the wave flies: fruit, bombs and empty lanes are shuffled by the Provably Fair hash.
// Every fruit in the cut raises the multiplier, a bomb in the cut or a cut with no fruit loses the round.
// The cut is stored before the wave exists for the player, so lane positions cannot be known or changed.

module.exports = {
  id: 'fruit_slash',
  name: 'Fruit Slash',
  tagline: 'Draw the cut, then throw · 10 waves · Bombs · Side bets · Provably Fair',
  category: 'exclusive',
  kind: 'exclusive',
  client: 'fruit_slash', // public/games/fruit_slash/index.html
  mechanic: 'lane_slash',
  reels_count: 8, // lanes
  rows_count: 10, // waves
  bet_multiplier: 20,
  volatility: 'medium / high',
  max_win_x: 5000,
  rtp: '96.50%',

  crash: {
    rtp: 0.965,
    lanes: 8,
    // per wave: [fruits, bombs]; the rest of the 8 lanes are empty
    modes: {
      medium: { label: 'Medium', waves: [[6, 1], [6, 1], [5, 1], [5, 2], [5, 2], [4, 2], [4, 2], [4, 3], [3, 3], [3, 4]] },
      high: { label: 'High', waves: [[5, 2], [5, 2], [4, 2], [4, 3], [4, 3], [3, 3], [3, 4], [3, 4], [2, 4], [2, 5]] }
    },
    default_mode: 'medium',
    wave_names: ['Warm-up', 'First fuse', 'Triple toss', 'Centre bomb', 'Watermelon', 'Speed throw', 'Golden pineapple', 'Chaos cluster', 'Fruit storm', 'Pitaya rush'],
    // each extra fruit in one cut pays more: weight 1, 1.25, 1.5, 1.75 … (the ladder is normalised so every wave is EV-neutral)
    fruit_step: 0.25,
    combo_min: 3,
    dragon_chance: 0.12, // a golden dragon fruit replaces one fruit in 12% of waves
    side_bets: {
      mega_combo: { label: 'Mega Combo', rtp: 0.965 }, // 3+ fruits in the cut, no bomb
      clean_sheet: { label: 'Clean Sheet', rtp: 0.965 }, // every fruit of the wave in the cut, no bomb
      dragon_fruit: { label: 'Dragon Fruit', rtp: 0.965 }, // the dragon fruit in the cut, no bomb
      insurance: { label: 'Bomb Insurance', rtp: 0.965 } // a bomb in the cut
    },
    // Samurai Shield: from wave 3, once per round, absorbs a bomb: multiplier one step back, same wave again
    helmet: { from_level: 3, step_back: true, max_saves: 1, rtp: 0.965, label: 'Samurai Shield' },
    skins: [
      { id: 'steel', name: 'Steel Katana', shots: 0 },
      { id: 'ice', name: 'Ice Trail', shots: 100 },
      { id: 'fire', name: 'Fire Dragon', shots: 200 },
      { id: 'neon', name: 'Neon Beam', shots: 300 },
      { id: 'sakura', name: 'Sakura Storm', shots: 400 }
    ]
  },

  theme: { accent: '#ff4d6d', bg1: '#3a1f12', bg2: '#120804', title: ['FRUIT', 'SLASH'], icon: '🍉', font: 'Bungee' },
  symbols: {},
  paytable: {}
};
