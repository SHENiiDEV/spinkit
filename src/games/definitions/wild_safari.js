// NEW Wild Safari — 25 lines 5x4

const { LINES_5x4_25, royal, icon, wild, scatter, reels } = require('../kit');

module.exports = {
  id: 'wild_safari',
  name: 'Wild Safari',
  tagline: '25 lines · 5x4 · Free Spins with x2 wins',
  category: 'animals',
  mechanic: 'lines',
  reels_count: 5,
  rows_count: 4,
  paylines: LINES_5x4_25,
  volatility: 'medium',
  max_win_x: 5000,
  theme: {
    accent: '#ffb23f', bg1: '#c2561a', bg2: '#2a0f05', frame: 'wood', particles: 'dust',
    reelBg: ['#3b2412', '#1e1108'], title: ['WILD', 'SAFARI'], medallions: true, icon: '🦁', font: 'Bungee'
  },
  symbols: {
    WILD: wild('Lion Wild', '🦁', '#ffb23f'),
    SCATTER: scatter('Sunset Scatter', '🌅', '#ff7a2f'),
    RHINO: icon('RHINO', 'Rhino', '🦏', '#b0b7c3'),
    ELEPHANT: icon('ELEPHANT', 'Elephant', '🐘', '#9aa7b8'),
    ZEBRA: icon('ZEBRA', 'Zebra', '🦓', '#eeeeee'),
    GIRAFFE: icon('GIRAFFE', 'Giraffe', '🦒', '#f0b35a'),
    A: royal('A', '#e84a5f'), K: royal('K', '#ffb23f'), Q: royal('Q', '#3db7ff'), J: royal('J', '#2fbf71'), '10': royal('10', '#c77dff')
  },
  paytable: {
    WILD: { 2: 2, 3: 20, 4: 80, 5: 400 },
    RHINO: { 3: 15, 4: 50, 5: 200 },
    ELEPHANT: { 3: 12, 4: 40, 5: 150 },
    ZEBRA: { 3: 10, 4: 30, 5: 100 },
    GIRAFFE: { 3: 8, 4: 25, 5: 80 },
    A: { 3: 5, 4: 15, 5: 50 }, K: { 3: 5, 4: 12, 5: 40 }, Q: { 3: 4, 4: 10, 5: 30 }, J: { 3: 3, 4: 8, 5: 25 }, '10': { 3: 3, 4: 8, 5: 25 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  reels: reels(5, { WILD: 4, SCATTER: 3, RHINO: 6, ELEPHANT: 8, ZEBRA: 10, GIRAFFE: 10, A: 16, K: 16, Q: 18, J: 18, '10': 20 }, { 0: { WILD: 0 } }),
  stacks: { RHINO: 2, ELEPHANT: 2, WILD: 2 },
  fs_reels: reels(5, { WILD: 9, SCATTER: 3, RHINO: 8, ELEPHANT: 8, ZEBRA: 10, GIRAFFE: 10, A: 14, K: 14, Q: 16, J: 16, '10': 18 }, { 0: { WILD: 0 } }),
  free_spins: { trigger: 3, spins: 10, retrigger_min: 3, retrigger_spins: 5, win_multiplier: 2, max_spins: 100, buy: true },
  pay_scale: 1
};
