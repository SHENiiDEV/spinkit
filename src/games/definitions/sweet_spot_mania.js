// Sweet Spot Mania — CLUSTERS 7x7
// Reference game for the reusable 'clusters' mechanic (src/engine/mechanics/clusters.js):
// cluster pays, tumbles and multiplier spots x2 … x1024 that stay for the whole free spins round.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'sweet_spot_mania',
  name: 'Sweet Spot Mania',
  tagline: 'Cluster pays · 7x7 · Multiplier spots up to x1024',
  category: 'candy',
  mechanic: 'clusters',
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: scripts/gen-art.js sweet_spot_mania (replace the files with painted art of the same size any time)
  theme: {
    accent: '#ff5fa2', bg1: '#ff8fc8', bg2: '#5a1fa0', frame: 'none', particles: 'sparkle',
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], title: ['SWEET SPOT', 'MANIA'], icon: '🍭', font: 'Fredoka',
    plainSymbols: true,
    symbolScale: 1,
    cover: '/games/sweet_spot_mania/assets/cover.jpg',
    stage: { image: '/games/sweet_spot_mania/assets/stage.jpg', width: 1400, height: 1254, reels: { x: 320, y: 300, w: 760, h: 760 }, pad: 6 }
  },
  symbols: {
    SCATTER: scatter('Lollipop Scatter', '🍭', '#ff5fa2', { image: '/games/sweet_spot_mania/assets/sym_scatter.png' }),
    CUPCAKE: icon('CUPCAKE', 'Cupcake', '🧁', '#ff7ab8', { image: '/games/sweet_spot_mania/assets/sym_cupcake.png' }),
    DONUT: icon('DONUT', 'Donut', '🍩', '#e0a15a', { image: '/games/sweet_spot_mania/assets/sym_donut.png' }),
    CHOCO: icon('CHOCO', 'Chocolate', '🍫', '#8a4a2a', { image: '/games/sweet_spot_mania/assets/sym_choco.png' }),
    RED: icon('RED', 'Cherry Heart', '❤️', '#ff2d55', { image: '/games/sweet_spot_mania/assets/sym_red.png' }),
    ORANGE: icon('ORANGE', 'Orange Gumdrop', '🔶', '#ff9a2a', { image: '/games/sweet_spot_mania/assets/sym_orange.png' }),
    GREEN: icon('GREEN', 'Apple Star', '💚', '#4ad15a', { image: '/games/sweet_spot_mania/assets/sym_green.png' }),
    BLUE: icon('BLUE', 'Blueberry Bonbon', '🔷', '#3a8aff', { image: '/games/sweet_spot_mania/assets/sym_blue.png' })
  },
  paytable: {
    CUPCAKE: { 5: 1, 6: 1.5, 7: 2, 8: 3, 9: 4, 10: 5, 11: 7.5, 12: 10, 13: 15, 14: 25, 15: 50 },
    DONUT: { 5: 0.75, 6: 1, 7: 1.5, 8: 2, 9: 3, 10: 4, 11: 5, 12: 7.5, 13: 10, 14: 15, 15: 30 },
    CHOCO: { 5: 0.5, 6: 0.75, 7: 1, 8: 1.5, 9: 2, 10: 3, 11: 4, 12: 5, 13: 7.5, 14: 10, 15: 20 },
    RED: { 5: 0.4, 6: 0.5, 7: 0.75, 8: 1, 9: 1.5, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7.5, 15: 15 },
    ORANGE: { 5: 0.3, 6: 0.4, 7: 0.5, 8: 0.75, 9: 1, 10: 1.5, 11: 2, 12: 3, 13: 4, 14: 5, 15: 10 },
    GREEN: { 5: 0.25, 6: 0.3, 7: 0.4, 8: 0.5, 9: 0.75, 10: 1, 11: 1.5, 12: 2, 13: 3, 14: 4, 15: 7.5 },
    BLUE: { 5: 0.2, 6: 0.25, 7: 0.3, 8: 0.4, 9: 0.5, 10: 0.75, 11: 1, 12: 1.5, 13: 2, 14: 3, 15: 5 }
  },
  weights: { CUPCAKE: 150, DONUT: 220, CHOCO: 300, RED: 500, ORANGE: 650, GREEN: 850, BLUE: 1100, SCATTER: 20 },
  fs_weights: { CUPCAKE: 150, DONUT: 220, CHOCO: 300, RED: 500, ORANGE: 650, GREEN: 950, BLUE: 1350, SCATTER: 18 },
  free_spins: {
    trigger: 3,
    spins: { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 },
    retrigger_min: 3,
    max_spins: 100,
    sticky_spots: true,
    buy: true
  },
  pay_scale: 1
};
