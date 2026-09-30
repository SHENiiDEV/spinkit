// Enchanted Knight — GIANTS 5x5
// Reference game for the reusable 'giants' mechanic (see src/engine/mechanics/giants.js):
// 3-row tall Princess / Knight Wild blocks, 3125 ways, sticky multiplier giants in Free Spins.

const { reels } = require('../kit');

module.exports = {
  id: 'enchanted_knight',
  name: 'Enchanted Knight',
  tagline: '3125 ways · 5x5 · Giant symbols · Sticky x2/x3 Giants in Free Spins',
  category: 'fantasy',
  mechanic: 'giants',
  reels_count: 5,
  rows_count: 5,
  bet_multiplier: 20,
  volatility: 'high',
  max_win_x: 25000,
  giants: {
    PRINCESS: { height: 3 },
    WILD: { height: 3 }
  },
  theme: {
    accent: '#f06aa6',
    bg1: '#4a1636',
    bg2: '#160512',
    frame: 'none',
    particles: 'petals',
    font: 'Cinzel',
    icon: '👑',
    title: ['ENCHANTED', 'KNIGHT'],
    logo: '/games/enchanted_knight/assets/logo.png',
    background: '/games/enchanted_knight/assets/background.jpg',
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    plainSymbols: true,
    symbolScale: 0.92,
    cover: '/games/enchanted_knight/assets/mockup.jpg', // lobby tile artwork
    // Stage layout: the whole machine (frame, logo, roses) is one picture; reels sit in its panel.
    stage: {
      image: '/games/enchanted_knight/assets/stage.jpg',
      width: 1400,
      height: 1254,
      reels: { x: 244, y: 254, w: 914, h: 853 },
      pad: 10
    }
  },
  symbols: {
    WILD: {
      id: 'WILD', name: 'Knight Wild', kind: 'wild', glyph: '⚔️', color: '#c4d3eb', isWild: true, giant: true,
      image: '/games/enchanted_knight/assets/symbols/giant_knight.png', tall_image: '/games/enchanted_knight/assets/symbols/giant_knight.png'
    },
    SCATTER: {
      id: 'SCATTER', name: 'Butterfly Shield', kind: 'scatter', glyph: '🦋', color: '#ff6fae', isScatter: true,
      image: '/games/enchanted_knight/assets/symbols/sym_butterfly.png'
    },
    PRINCESS: {
      id: 'PRINCESS', name: 'Princess', kind: 'icon', glyph: '👸', color: '#f5b5c8', giant: true,
      image: '/games/enchanted_knight/assets/symbols/giant_princess.png', tall_image: '/games/enchanted_knight/assets/symbols/giant_princess.png'
    },
    SWAN: { id: 'SWAN', name: 'Silver Swan', kind: 'icon', glyph: '🦢', color: '#f3c4db', image: '/games/enchanted_knight/assets/symbols/sym_swan.png' },
    RING_BOX: { id: 'RING_BOX', name: 'Diamond Ring', kind: 'icon', glyph: '💍', color: '#c77dff', image: '/games/enchanted_knight/assets/symbols/sym_ring.png' },
    DAGGER: { id: 'DAGGER', name: 'Kissed Dagger', kind: 'icon', glyph: '🗡️', color: '#6888c8', image: '/games/enchanted_knight/assets/symbols/sym_dagger.png' },
    LOVE_LETTER: { id: 'LOVE_LETTER', name: 'Love Letter', kind: 'icon', glyph: '💌', color: '#f5d082', image: '/games/enchanted_knight/assets/symbols/sym_letter.png' },
    HEART_GEM: { id: 'HEART_GEM', name: 'Ruby Heart', kind: 'icon', glyph: '❤️', color: '#e82e4e', image: '/games/enchanted_knight/assets/symbols/sym_heart.png' },
    DIAMOND_GEM: { id: 'DIAMOND_GEM', name: 'Pink Diamond', kind: 'icon', glyph: '💎', color: '#e84ea8', image: '/games/enchanted_knight/assets/symbols/sym_diamond.png' },
    STAR_GEM: { id: 'STAR_GEM', name: 'Sun Star', kind: 'icon', glyph: '⭐', color: '#f5b820', image: '/games/enchanted_knight/assets/symbols/sym_star.png' },
    MOON_GEM: { id: 'MOON_GEM', name: 'Crescent Moon', kind: 'icon', glyph: '🌙', color: '#884ee8', image: '/games/enchanted_knight/assets/symbols/sym_moon.png' }
  },
  paytable: {
    PRINCESS: { 3: 25, 4: 60, 5: 150 },
    SWAN: { 3: 15, 4: 40, 5: 100 },
    RING_BOX: { 3: 12, 4: 30, 5: 80 },
    DAGGER: { 3: 10, 4: 25, 5: 60 },
    LOVE_LETTER: { 3: 6, 4: 15, 5: 40 },
    HEART_GEM: { 3: 5, 4: 12, 5: 30 },
    DIAMOND_GEM: { 3: 4, 4: 10, 5: 25 },
    STAR_GEM: { 3: 3, 4: 8, 5: 20 },
    MOON_GEM: { 3: 3, 4: 8, 5: 20 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  // Giant symbols: the count is the number of 3-row BLOCKS on the strip.
  reels: reels(
    5,
    { WILD: 1, PRINCESS: 1, SCATTER: 1, SWAN: 5, RING_BOX: 6, DAGGER: 6, LOVE_LETTER: 9, HEART_GEM: 9, DIAMOND_GEM: 10, STAR_GEM: 10, MOON_GEM: 11 },
    { 0: { WILD: 0 }, 2: { SCATTER: 2 } }
  ),
  fs_reels: reels(
    5,
    { WILD: 1, PRINCESS: 1, SCATTER: 1, SWAN: 5, RING_BOX: 6, DAGGER: 6, LOVE_LETTER: 9, HEART_GEM: 9, DIAMOND_GEM: 10, STAR_GEM: 10, MOON_GEM: 11 },
    { 0: { WILD: 0 } }
  ),
  free_spins: {
    trigger: 3,
    spins: 10,
    retrigger_min: 3,
    retrigger_spins: 5,
    max_spins: 60,
    buy: true,
    sticky_giants: true,
    // Sticky Knight Wild: x1 … x500 (weights — small values are common, x500 is very rare).
    // Sticky Princess keeps x2 / x3.
    sticky_multipliers: {
      WILD: { 1: 600, 2: 520, 3: 360, 5: 240, 10: 120, 15: 60, 25: 36, 50: 18, 100: 8, 250: 3, 500: 1 },
      PRINCESS: { 2: 60, 3: 40 }
    }
  },
  pay_scale: 1
};
