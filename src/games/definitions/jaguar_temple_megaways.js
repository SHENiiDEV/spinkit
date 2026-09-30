// Jaguar Temple Megaways — MEGAWAYS 6 reels x 2-7 rows
// Reference game for the reusable 'megaways' mechanic (src/engine/mechanics/megaways.js):
// up to 117,649 ways, cascades and a win multiplier that grows +1 per cascade (never resets in free spins).

const { icon, wild, scatter, reels } = require('../kit');

module.exports = {
  id: 'jaguar_temple_megaways',
  name: 'Jaguar Temple Megaways',
  tagline: 'Megaways · up to 117,649 ways · Cascades · Unlimited win multiplier',
  category: 'aztec',
  mechanic: 'megaways',
  reels_count: 6,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 20000,
  // Artwork: scripts/gen-art.js jaguar_temple_megaways (replace the files with painted art of the same size any time)
  theme: {
    accent: '#3ddc97', bg1: '#1f5a3a', bg2: '#06140c', frame: 'none', particles: 'leaves',
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], title: ['JAGUAR TEMPLE', 'MEGAWAYS'], icon: '🐆', font: 'Cinzel',
    plainSymbols: true,
    symbolScale: 1,
    cover: '/games/jaguar_temple_megaways/assets/cover.jpg',
    stage: { image: '/games/jaguar_temple_megaways/assets/stage.jpg', width: 1400, height: 1254, reels: { x: 350, y: 272, w: 700, h: 816 }, pad: 4 }
  },
  symbols: {
    WILD: wild('Golden Sun Wild', '☀️', '#ffd23f', { image: '/games/jaguar_temple_megaways/assets/sym_wild.png' }),
    SCATTER: scatter('Temple Scatter', '🛕', '#3ddc97', { image: '/games/jaguar_temple_megaways/assets/sym_scatter.png' }),
    JAGUAR: icon('JAGUAR', 'Jaguar', '🐆', '#ffb23f', { image: '/games/jaguar_temple_megaways/assets/sym_jaguar.png' }),
    IDOL: icon('IDOL', 'Stone Idol', '🗿', '#b0b7c3', { image: '/games/jaguar_temple_megaways/assets/sym_idol.png' }),
    SERPENT: icon('SERPENT', 'Feathered Serpent', '🐍', '#3ddc97', { image: '/games/jaguar_temple_megaways/assets/sym_serpent.png' }),
    EAGLE: icon('EAGLE', 'Eagle Warrior', '🦅', '#e0a15a', { image: '/games/jaguar_temple_megaways/assets/sym_eagle.png' }),
    JADE: icon('JADE', 'Jade', '💚', '#22c46b', { gem: true, shape: 'hex', image: '/games/jaguar_temple_megaways/assets/sym_jade.png' }),
    RUBY: icon('RUBY', 'Ruby', '♦️', '#e8283f', { gem: true, shape: 'octagon', image: '/games/jaguar_temple_megaways/assets/sym_ruby.png' }),
    TOPAZ: icon('TOPAZ', 'Topaz', '🔶', '#ffb020', { gem: true, shape: 'triangle', image: '/games/jaguar_temple_megaways/assets/sym_topaz.png' }),
    SAPPHIRE: icon('SAPPHIRE', 'Sapphire', '🔷', '#2f7cf0', { gem: true, shape: 'diamond', image: '/games/jaguar_temple_megaways/assets/sym_sapphire.png' })
  },
  paytable: {
    JAGUAR: { 3: 5, 4: 10, 5: 25, 6: 50 },
    IDOL: { 3: 4, 4: 8, 5: 20, 6: 40 },
    SERPENT: { 3: 3, 4: 6, 5: 15, 6: 30 },
    EAGLE: { 3: 2, 4: 5, 5: 10, 6: 20 },
    JADE: { 3: 1, 4: 2, 5: 4, 6: 10 },
    RUBY: { 3: 1, 4: 2, 5: 3, 6: 8 },
    TOPAZ: { 3: 0.5, 4: 1, 5: 2, 6: 5 },
    SAPPHIRE: { 3: 0.5, 4: 1, 5: 2, 6: 5 }
  },
  heights: { 2: 10, 3: 18, 4: 24, 5: 22, 6: 16, 7: 10 },
  fs_heights: { 2: 2, 3: 8, 4: 18, 5: 26, 6: 26, 7: 20 },
  reel_weights: reels(
    6,
    { JAGUAR: 60, IDOL: 80, SERPENT: 100, EAGLE: 120, JADE: 160, RUBY: 180, TOPAZ: 200, SAPPHIRE: 220, WILD: 30, SCATTER: 17 },
    { 0: { WILD: 0 }, 5: { WILD: 0 } }
  ),
  fs_reel_weights: reels(
    6,
    { JAGUAR: 80, IDOL: 100, SERPENT: 120, EAGLE: 140, JADE: 160, RUBY: 180, TOPAZ: 200, SAPPHIRE: 220, WILD: 60, SCATTER: 13 },
    { 0: { WILD: 0 }, 5: { WILD: 0 } }
  ),
  free_spins: {
    trigger: 4,
    spins: { 4: 12, 5: 17, 6: 22 },
    retrigger_min: 3,
    retrigger_spins: 5,
    max_spins: 100,
    persistent_multiplier: true,
    buy: true
  },
  pay_scale: 1
};
