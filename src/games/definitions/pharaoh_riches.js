// Egypt — lines

const { LINES_5x3_20, royal, icon, wild, scatter, reels } = require('../kit');

module.exports = {
  id: 'pharaoh_riches',
  name: "Pharaoh's Riches",
  tagline: '20 lines · Free Spins with x3 wins',
  category: 'egypt',
  mechanic: 'lines',
  reels_count: 5,
  rows_count: 3,
  paylines: LINES_5x3_20,
  volatility: 'medium',
  max_win_x: 5000,
  theme: {
    accent: '#f5c542', bg1: '#3a2308', bg2: '#0e0803', frame: 'gold', particles: 'dust',
    reelBg: ['#2a1a07', '#140c03'], title: ["PHARAOH'S", 'RICHES'], medallions: true, icon: '👑', font: 'Cinzel'
  },
  symbols: {
    WILD: wild('Pharaoh Wild', '👑', '#f5c542'),
    SCATTER: scatter('Sacred Scroll', '📜', '#ffb347'),
    FALCON: icon('FALCON', 'Falcon of Horus', '🦅', '#e8a33d'),
    COBRA: icon('COBRA', 'Royal Cobra', '🐍', '#43c26b'),
    SCARAB: icon('SCARAB', 'Jeweled Scarab', '🪲', '#3fb7e0'),
    JAR: icon('JAR', 'Canopic Jar', '🏺', '#d9774a'),
    A: royal('A', '#e84a5f'), K: royal('K', '#9b59d0'), Q: royal('Q', '#3d8ee8'), J: royal('J', '#2fbf71'), '10': royal('10', '#f0a030')
  },
  paytable: {
    WILD: { 2: 2, 3: 25, 4: 100, 5: 500 },
    FALCON: { 2: 1, 3: 20, 4: 75, 5: 300 },
    COBRA: { 3: 15, 4: 50, 5: 200 },
    SCARAB: { 3: 12, 4: 40, 5: 150 },
    JAR: { 3: 10, 4: 30, 5: 120 },
    A: { 3: 5, 4: 20, 5: 75 }, K: { 3: 5, 4: 15, 5: 60 }, Q: { 3: 4, 4: 12, 5: 50 }, J: { 3: 3, 4: 10, 5: 40 }, '10': { 3: 3, 4: 10, 5: 40 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  reels: reels(5, { WILD: 2, SCATTER: 2, FALCON: 3, COBRA: 4, SCARAB: 5, JAR: 5, A: 8, K: 8, Q: 9, J: 9, '10': 10 }, { 0: { WILD: 0 } }),
  free_spins: { trigger: 3, spins: 10, retrigger_min: 3, retrigger_spins: 10, win_multiplier: 3, max_spins: 100, buy: true },
  pay_scale: 1
};
