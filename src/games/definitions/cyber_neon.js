// Cyberpunk — 243 ways

const { royal, icon, wild, scatter, reels } = require('../kit');

module.exports = {
  id: 'cyber_neon',
  name: 'Cyberpunk Neon 2099',
  tagline: '243 ways · Free Spins with x2 / x3 / x5 Wilds',
  category: 'scifi',
  mechanic: 'ways',
  reels_count: 5,
  rows_count: 3,
  bet_multiplier: 20,
  volatility: 'high',
  max_win_x: 5000,
  theme: {
    accent: '#18e0ff', bg1: '#1b0a3a', bg2: '#03020d', frame: 'neon', particles: 'neon',
    reelBg: ['#0b0f2a', '#05061a'], title: ['CYBERPUNK', 'NEON 2099'], icon: '🤖', font: 'Orbitron'
  },
  symbols: {
    WILD: wild('Holo Wild', '💠', '#18e0ff'),
    SCATTER: scatter('Quantum Core', '🌀', '#ff2bd6'),
    ANDROID: icon('ANDROID', 'Android', '🤖', '#ff2bd6'),
    ALIEN: icon('ALIEN', 'Alien Hacker', '👾', '#9d5cff'),
    CHIP: icon('CHIP', 'Neural Chip', '💾', '#18e0ff'),
    BOLT: icon('BOLT', 'Power Cell', '🔋', '#3dff8f'),
    A: royal('A', '#ff2bd6'), K: royal('K', '#9d5cff'), Q: royal('Q', '#18e0ff'), J: royal('J', '#3dff8f')
  },
  paytable: {
    ANDROID: { 3: 20, 4: 50, 5: 150 },
    ALIEN: { 3: 15, 4: 40, 5: 100 },
    CHIP: { 3: 10, 4: 25, 5: 75 },
    BOLT: { 3: 8, 4: 20, 5: 60 },
    A: { 3: 5, 4: 10, 5: 30 }, K: { 3: 5, 4: 10, 5: 25 }, Q: { 3: 3, 4: 8, 5: 20 }, J: { 3: 3, 4: 8, 5: 20 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  reels: reels(5, { WILD: 4, SCATTER: 3, ANDROID: 6, ALIEN: 8, CHIP: 10, BOLT: 10, A: 14, K: 16, Q: 16, J: 18 }, { 0: { WILD: 0 } }),
  stacks: { ANDROID: 2, ALIEN: 2, WILD: 2 },
  fs_reels: reels(5, { WILD: 7, SCATTER: 3, ANDROID: 8, ALIEN: 8, CHIP: 10, BOLT: 10, A: 12, K: 14, Q: 14, J: 16 }, { 0: { WILD: 0 } }),
  free_spins: {
    trigger: 3, spins: { 3: 10, 4: 15, 5: 20 }, retrigger_min: 3, retrigger_spins: 5, max_spins: 100,
    wild_multipliers: { 2: 60, 3: 30, 5: 10 }, buy: true
  },
  pay_scale: 1
};
