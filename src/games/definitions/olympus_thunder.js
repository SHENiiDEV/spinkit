// Olympus — tumble, accumulating multipliers

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'olympus_thunder',
  name: 'Olympus Thunder',
  tagline: 'Pay anywhere · Tumble · Lightning multipliers up to x500',
  category: 'mythology',
  mechanic: 'tumble',
  reels_count: 6,
  rows_count: 5,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 5000,
  theme: {
    accent: '#ffd76a', bg1: '#1d4d8f', bg2: '#070f24', frame: 'marble', particles: 'clouds',
    reelBg: ['#1a2f5c', '#0b1633'], title: ['OLYMPUS', 'THUNDER'], icon: '⚡', font: 'Cinzel'
  },
  symbols: {
    SCATTER: scatter('Thunder Orb', '🌩️', '#ffd76a'),
    MULT: { id: 'MULT', name: 'Lightning Multiplier', kind: 'mult', glyph: '⚡', color: '#ffd76a' },
    CROWN: icon('CROWN', 'Crown of Olympus', '👑', '#ffd76a'),
    HOURGLASS: icon('HOURGLASS', 'Hourglass', '⏳', '#f0b35a'),
    RING: icon('RING', 'Ring of Power', '💍', '#b9e6ff'),
    CHALICE: icon('CHALICE', 'Golden Chalice', '🏆', '#ffcc33'),
    BLUE: icon('BLUE', 'Sapphire', '🔷', '#2f7cf0', { gem: true, shape: 'hex' }),
    GREEN: icon('GREEN', 'Emerald', '💚', '#22c46b', { gem: true, shape: 'octagon' }),
    RED: icon('RED', 'Ruby', '♦️', '#e8283f', { gem: true, shape: 'heart' }),
    PURPLE: icon('PURPLE', 'Amethyst', '🔮', '#9b3ff0', { gem: true, shape: 'oval' }),
    YELLOW: icon('YELLOW', 'Topaz', '🔶', '#ffb020', { gem: true, shape: 'triangle' })
  },
  paytable: {
    CROWN: { 8: 10, 10: 25, 12: 50 },
    HOURGLASS: { 8: 2.5, 10: 10, 12: 25 },
    RING: { 8: 2, 10: 5, 12: 15 },
    CHALICE: { 8: 1.5, 10: 2, 12: 12 },
    RED: { 8: 1, 10: 1.5, 12: 10 },
    PURPLE: { 8: 0.8, 10: 1.2, 12: 8 },
    YELLOW: { 8: 0.5, 10: 1, 12: 5 },
    GREEN: { 8: 0.4, 10: 0.9, 12: 4 },
    BLUE: { 8: 0.25, 10: 0.75, 12: 2 },
    SCATTER: { 4: 3, 5: 5, 6: 100 }
  },
  weights: { CROWN: 40, HOURGLASS: 50, RING: 60, CHALICE: 70, RED: 90, PURPLE: 100, YELLOW: 110, GREEN: 120, BLUE: 130, SCATTER: 13 },
  fs_weights: { CROWN: 40, HOURGLASS: 50, RING: 60, CHALICE: 70, RED: 90, PURPLE: 100, YELLOW: 110, GREEN: 120, BLUE: 130, SCATTER: 11 },
  multipliers: {
    mode: 'accumulate',
    chance_base: 30,
    chance_fs: 1000,
    values: { 2: 3000, 3: 2000, 4: 1500, 5: 1200, 6: 800, 8: 600, 10: 500, 12: 300, 15: 200, 20: 150, 25: 100, 50: 40, 100: 15, 250: 4, 500: 1 }
  },
  free_spins: { trigger: 4, spins: 15, retrigger_min: 3, retrigger_spins: 5, max_spins: 100, buy: true },
  pay_scale: 1
};
