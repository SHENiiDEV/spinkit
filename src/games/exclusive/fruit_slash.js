// Fruit Slash — SpinKit Exclusive · swipe step crash (src/engine/exclusive/step-crash.js)
//
// A round is up to 10 waves of fruit thrown from the bottom of the screen, with bombs among them.
// Each cleared wave raises the multiplier, CASH OUT is allowed after any cleared wave, a bomb blast
// ends the round. The fair hash of each wave decides its result before it is thrown; the player's
// swipes only cut and steer the animation onto that result.
//
// Math is the same as Apple Shooter (rtp / chance_1 / … / chance_k, every wave after the first EV-neutral)
// with no wind, plus the Frenzy Banana bonus outcome (ladder x1.5 on that wave, EV-neutral via D)
// and a Samurai Shield that undoes one bomb per round (multiplier one step back).

module.exports = {
  id: 'fruit_slash',
  name: 'Fruit Slash',
  tagline: 'Swipe step crash · 10 waves · Bombs · Side bets · Provably Fair',
  category: 'exclusive',
  kind: 'exclusive',
  client: 'fruit_slash', // public/games/fruit_slash/index.html
  mechanic: 'step_crash',
  reels_count: 1,
  rows_count: 10,
  bet_multiplier: 20,
  volatility: 'medium / high',
  max_win_x: 5000,
  rtp: '96.50%',

  crash: {
    rtp: 0.965,
    modes: {
      // GDD table: 92 / 88 / 85 / 80 / 75 / 70 / 65 / 60 / 50 / 40 %
      medium: { label: 'Medium', survival: [0.92, 0.88, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.4] },
      high: { label: 'High', survival: [0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.45, 0.4, 0.35, 0.3] }
    },
    default_mode: 'medium',
    // what each wave throws (cosmetic; the client adds a bomb when a wave is lethal)
    waves: [
      { name: 'Warm-up', fruits: 2, bombs: 0 },
      { name: 'First fuse', fruits: 3, bombs: 1 },
      { name: 'Triple toss', fruits: 3, bombs: 1 },
      { name: 'Centre bomb', fruits: 4, bombs: 1 },
      { name: 'Watermelon', fruits: 4, bombs: 2 },
      { name: 'Speed throw', fruits: 4, bombs: 2 },
      { name: 'Golden pineapple', fruits: 5, bombs: 2 },
      { name: 'Chaos cluster', fruits: 5, bombs: 3 },
      { name: 'Fruit storm', fruits: 5, bombs: 3 },
      { name: 'Pitaya rush', fruits: 6, bombs: 3 }
    ],
    // how a cleared wave plays out (shares of the clear chance, in hash order)
    outcomes: { dragon_fruit: 0.05, mega_combo: 0.1, bomb_deflect: 0.2, frenzy: 0.04, clean: 0.38, miss: 0.23 },
    // Frenzy Banana: slow motion, bombs vanish, the wave pays x1.5 on top of its step
    bonus: { outcome: 'frenzy', boost: 1.5 },
    side_bets: {
      mega_combo: { label: 'Mega Combo', rtp: 0.965, wins_on: ['mega_combo'] },
      bomb_deflect: { label: 'Bomb Deflect', rtp: 0.965, wins_on: ['bomb_deflect'] },
      dragon_fruit: { label: 'Dragon Fruit', rtp: 0.965, wins_on: ['dragon_fruit'] },
      clean_sheet: { label: 'Clean Sheet', rtp: 0.965, wins_on: ['dragon_fruit', 'mega_combo', 'bomb_deflect', 'frenzy', 'clean'] },
      insurance: { label: 'Bomb Insurance', rtp: 0.965, wins_on: ['lethal'] }
    },
    // Samurai Shield: bought per wave from wave 3, absorbs one bomb per round, multiplier one step back
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
