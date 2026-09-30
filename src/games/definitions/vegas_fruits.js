// Classic 3x3 — lines

const { LINES_3x3_5, icon, scatter, reels } = require('../kit');

module.exports = {
  id: 'vegas_fruits',
  name: 'Vegas Fruits & 777',
  tagline: 'Classic 3-reel · 5 lines · Star Scatter pays',
  category: 'classic',
  mechanic: 'lines',
  reels_count: 3,
  rows_count: 3,
  paylines: LINES_3x3_5,
  volatility: 'low',
  max_win_x: 1000,
  theme: {
    accent: '#ff3b3b', bg1: '#4a0a14', bg2: '#12020a', frame: 'chrome', particles: 'lights',
    reelBg: ['#fff8ec', '#f1dfc0'], lightReels: true, title: ['VEGAS', 'FRUITS 777'], icon: '🍒', font: 'Bungee'
  },
  symbols: {
    WILD: { id: 'WILD', name: 'Lucky 7 Wild', kind: 'seven', label: '7', color: '#e3212b', isWild: true },
    SCATTER: scatter('Golden Star', '⭐', '#ffc933'),
    BAR: { id: 'BAR', name: 'Triple BAR', kind: 'bar', label: 'BAR', color: '#222' },
    BELL: icon('BELL', 'Golden Bell', '🔔', '#f0a500'),
    MELON: icon('MELON', 'Watermelon', '🍉', '#3cb44b'),
    GRAPES: icon('GRAPES', 'Grapes', '🍇', '#8e44ad'),
    PLUM: icon('PLUM', 'Plum', '🫐', '#5b5fc7'),
    ORANGE: icon('ORANGE', 'Orange', '🍊', '#ff8c1a'),
    LEMON: icon('LEMON', 'Lemon', '🍋', '#f5d400'),
    CHERRY: icon('CHERRY', 'Cherry', '🍒', '#e3212b')
  },
  paytable: {
    WILD: { 3: 100 },
    BAR: { 3: 50 },
    BELL: { 3: 30 },
    MELON: { 3: 20 },
    GRAPES: { 3: 15 },
    PLUM: { 3: 10 },
    ORANGE: { 3: 8 },
    LEMON: { 3: 6 },
    CHERRY: { 2: 1, 3: 5 },
    SCATTER: { 3: 5 }
  },
  reels: reels(3, { WILD: 1, SCATTER: 1, BAR: 2, BELL: 3, MELON: 3, GRAPES: 4, PLUM: 4, ORANGE: 5, LEMON: 5, CHERRY: 5 }),
  free_spins: null,
  pay_scale: 1
};
