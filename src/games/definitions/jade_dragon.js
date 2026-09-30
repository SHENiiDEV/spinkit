// NEW Jade Dragon — 1024 ways 5x4

const { royal, icon, wild, scatter, reels } = require('../kit');

module.exports = {
  id: 'jade_dragon',
  name: 'Jade Dragon',
  tagline: '1024 ways · 12 Free Spins with x2 wins',
  category: 'asian',
  mechanic: 'ways',
  reels_count: 5,
  rows_count: 4,
  bet_multiplier: 20,
  volatility: 'medium',
  max_win_x: 5000,
  theme: {
    accent: '#3ddc97', bg1: '#6b0d12', bg2: '#140204', frame: 'jade', particles: 'petals',
    reelBg: ['#3a0a0e', '#1c0306'], title: ['JADE', 'DRAGON'], medallions: true, icon: '🐉', font: 'Cinzel'
  },
  symbols: {
    WILD: wild('Dragon Wild', '🐉', '#3ddc97'),
    SCATTER: scatter('Golden Lantern', '🏮', '#ff4d3d'),
    TIGER: icon('TIGER', 'White Tiger', '🐅', '#ffb23f'),
    KOI: icon('KOI', 'Golden Koi', '🐟', '#ff8a3d'),
    COIN: icon('COIN', 'Lucky Coin', '🪙', '#ffd23f'),
    FAN: icon('FAN', 'Silk Fan', '🪭', '#ff5fa2'),
    A: royal('A', '#ff4d3d'), K: royal('K', '#ffb23f'), Q: royal('Q', '#3ddc97'), J: royal('J', '#3db7ff'), '10': royal('10', '#c77dff')
  },
  paytable: {
    TIGER: { 3: 10, 4: 25, 5: 100 },
    KOI: { 3: 8, 4: 20, 5: 75 },
    COIN: { 3: 6, 4: 15, 5: 50 },
    FAN: { 3: 5, 4: 12, 5: 40 },
    A: { 3: 3, 4: 6, 5: 20 }, K: { 3: 3, 4: 6, 5: 20 }, Q: { 3: 2, 4: 5, 5: 15 }, J: { 3: 2, 4: 5, 5: 15 }, '10': { 3: 2, 4: 4, 5: 12 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  reels: reels(5, { WILD: 4, SCATTER: 3, TIGER: 8, KOI: 10, COIN: 12, FAN: 12, A: 18, K: 18, Q: 20, J: 20, '10': 22 }, { 0: { WILD: 0 } }),
  stacks: { TIGER: 3, KOI: 2, WILD: 2 },
  fs_reels: reels(5, { WILD: 12, SCATTER: 3, TIGER: 10, KOI: 10, COIN: 12, FAN: 12, A: 16, K: 16, Q: 18, J: 18, '10': 20 }, { 0: { WILD: 0 } }),
  free_spins: { trigger: 3, spins: 12, retrigger_min: 3, retrigger_spins: 6, win_multiplier: 2, max_spins: 100, buy: true },
  pay_scale: 1
};
