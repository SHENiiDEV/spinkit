// Candy — tumble, bombs in free spins

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'sweet_sugar',
  name: 'Candy Cascade',
  tagline: 'Pay anywhere · Tumble · Candy Bombs up to x100 in Free Spins',
  category: 'candy',
  mechanic: 'tumble',
  reels_count: 6,
  rows_count: 5,
  bet_multiplier: 20,
  volatility: 'high',
  max_win_x: 21100,
  theme: {
    accent: '#ff5fa2', bg1: '#ff9ccf', bg2: '#7b3fc4', frame: 'candy', particles: 'sparkle',
    reelBg: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)'], title: ['CANDY', 'CASCADE'], icon: '🍭', font: 'Fredoka'
  },
  symbols: {
    SCATTER: scatter('Lollipop Scatter', '🍭', '#ff5fa2'),
    MULT: { id: 'MULT', name: 'Candy Bomb', kind: 'mult', glyph: '🍬', color: '#ff5fa2', bomb: true },
    HEART: icon('HEART', 'Heart Candy', '❤️', '#ff2d55'),
    PURPLE: icon('PURPLE', 'Grape Gummy', '🍇', '#9b59d0'),
    GREEN: icon('GREEN', 'Apple Drop', '🍏', '#5ed15a'),
    BLUE: icon('BLUE', 'Blue Jelly', '🫐', '#4a7df0'),
    APPLE: icon('APPLE', 'Candy Apple', '🍎', '#ff4040'),
    PLUM: icon('PLUM', 'Peach Chew', '🍑', '#ff9a5a'),
    MELON: icon('MELON', 'Melon Slice', '🍉', '#3cb44b'),
    GRAPE: icon('GRAPE', 'Cookie', '🍪', '#c98a4b'),
    BANANA: icon('BANANA', 'Banana Taffy', '🍌', '#ffd23f')
  },
  paytable: {
    HEART: { 8: 10, 10: 25, 12: 50 },
    PURPLE: { 8: 2.5, 10: 10, 12: 25 },
    GREEN: { 8: 2, 10: 5, 12: 15 },
    BLUE: { 8: 1.5, 10: 2, 12: 12 },
    APPLE: { 8: 1, 10: 1.5, 12: 10 },
    PLUM: { 8: 0.8, 10: 1.2, 12: 8 },
    MELON: { 8: 0.5, 10: 1, 12: 5 },
    GRAPE: { 8: 0.4, 10: 0.9, 12: 4 },
    BANANA: { 8: 0.25, 10: 0.75, 12: 2 },
    SCATTER: { 4: 3, 5: 5, 6: 100 }
  },
  weights: { HEART: 40, PURPLE: 50, GREEN: 60, BLUE: 70, APPLE: 90, PLUM: 100, MELON: 110, GRAPE: 120, BANANA: 130, SCATTER: 13 },
  fs_weights: { HEART: 45, PURPLE: 55, GREEN: 65, BLUE: 75, APPLE: 95, PLUM: 110, MELON: 125, GRAPE: 140, BANANA: 155, SCATTER: 11 },
  multipliers: {
    mode: 'per_spin',
    chance_base: 0,
    chance_fs: 1500,
    values: { 2: 1500, 3: 1500, 4: 1300, 5: 1200, 6: 1000, 8: 900, 10: 800, 12: 500, 15: 400, 20: 300, 25: 250, 50: 90, 100: 30 }
  },
  free_spins: { trigger: 4, spins: 10, retrigger_min: 3, retrigger_spins: 5, max_spins: 100, buy: true },
  pay_scale: 1
};
