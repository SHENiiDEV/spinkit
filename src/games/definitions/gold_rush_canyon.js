// Gold Rush Canyon — MATCH LINES 7x8
// Reference game for the reusable 'matchlines' mechanic (src/engine/mechanics/matchlines.js):
// 3+ in a row or column anywhere pay and cascade; the multiplier grows x1, x2, x3 … per cascade,
// in free spins only even steps x2, x4, x6 … and it is kept for the whole feature (max x1024).

const { royal, icon, wild, scatter } = require('../kit');

module.exports = {
  id: 'gold_rush_canyon',
  name: 'Gold Rush Canyon',
  tagline: '7x8 · Line cascades · Multiplier up to x1024 · Even multipliers in Free Spins',
  category: 'western',
  mechanic: 'matchlines',
  reels_count: 7,
  rows_count: 8,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 25000,
  min_line: 3,
  multiplier: { base: { start: 1, step: 1 }, fs: { start: 2, step: 2 }, max: 1024 },
  // Artwork: scripts/gen-art.js gold_rush_canyon (A-9 are drawn by the client)
  theme: {
    accent: '#ffb23f', bg1: '#8a3a12', bg2: '#1a0802', frame: 'none', particles: 'dust',
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], title: ['GOLD RUSH', 'CANYON'], icon: '🤠', font: 'Rye',
    plainSymbols: true,
    symbolScale: 1,
    cover: '/games/gold_rush_canyon/assets/cover.jpg',
    stage: { image: '/games/gold_rush_canyon/assets/stage.jpg', width: 1400, height: 1254, reels: { x: 336, y: 300, w: 728, h: 832 }, pad: 4 }
  },
  symbols: {
    WILD: wild('Dynamite Wild', '🧨', '#ff4a2a', { image: '/games/gold_rush_canyon/assets/sym_wild.png' }),
    SCATTER: scatter('Sheriff Badge', '⭐', '#ffd23f', { image: '/games/gold_rush_canyon/assets/sym_scatter.png' }),
    SHERIFF: icon('SHERIFF', 'Sheriff', '🤠', '#ffcf3a', { image: '/games/gold_rush_canyon/assets/sym_sheriff.png' }),
    HORSE: icon('HORSE', 'Mustang', '🐎', '#b0703a', { image: '/games/gold_rush_canyon/assets/sym_horse.png' }),
    BOOTS: icon('BOOTS', 'Cowboy Boots', '👢', '#8a4a2a', { image: '/games/gold_rush_canyon/assets/sym_boots.png' }),
    GOLD: icon('GOLD', 'Gold Sack', '💰', '#ffcf3a', { image: '/games/gold_rush_canyon/assets/sym_gold.png' }),
    A: royal('A', '#ff5a3a'), K: royal('K', '#ffb23f'), Q: royal('Q', '#3ddc97'), J: royal('J', '#3db7ff'), '10': royal('10', '#c77dff'), '9': royal('9', '#ff7ab8')
  },
  paytable: {
    SHERIFF: { 3: 0.5, 4: 1.5, 5: 4, 6: 10, 7: 25, 8: 50 },
    HORSE: { 3: 0.4, 4: 1.2, 5: 3, 6: 8, 7: 20, 8: 40 },
    BOOTS: { 3: 0.3, 4: 1, 5: 2.5, 6: 6, 7: 15, 8: 30 },
    GOLD: { 3: 0.25, 4: 0.8, 5: 2, 6: 5, 7: 12, 8: 25 },
    A: { 3: 0.15, 4: 0.4, 5: 1, 6: 2.5, 7: 6, 8: 12 },
    K: { 3: 0.15, 4: 0.4, 5: 1, 6: 2.5, 7: 6, 8: 12 },
    Q: { 3: 0.12, 4: 0.3, 5: 0.8, 6: 2, 7: 5, 8: 10 },
    J: { 3: 0.12, 4: 0.3, 5: 0.8, 6: 2, 7: 5, 8: 10 },
    '10': { 3: 0.1, 4: 0.25, 5: 0.6, 6: 1.5, 7: 4, 8: 8 },
    '9': { 3: 0.1, 4: 0.25, 5: 0.6, 6: 1.5, 7: 4, 8: 8 }
  },
  weights: { SHERIFF: 50, HORSE: 60, BOOTS: 70, GOLD: 80, A: 95, K: 100, Q: 105, J: 110, '10': 115, '9': 120, WILD: 18, SCATTER: 9.5 },
  fs_weights: { SHERIFF: 50, HORSE: 60, BOOTS: 70, GOLD: 80, A: 95, K: 100, Q: 105, J: 110, '10': 115, '9': 120, WILD: 46, SCATTER: 10 },
  free_spins: {
    trigger: 4,
    spins: { 4: 10, 5: 12, 6: 15, 7: 20 },
    retrigger_min: 3,
    retrigger_spins: 5,
    max_spins: 100,
    persistent_multiplier: true,
    buy: true
  },
  pay_scale: 1
};
