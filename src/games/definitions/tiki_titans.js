// Tiki Titans — GIANTS on a 2-4-5-6-5-4-2 grid
// Same 'giants' mechanic as Enchanted Knight on a diamond-shaped grid (reel_heights):
// the Tiki Totem Wild is a reel giant — it always covers its whole reel (4 to 6 rows) —
// and in Free Spins every totem sticks with a random x5 … x5000 multiplier.
// Template for re-skins: reskin(require('./tiki_titans'), { ... }) in src/games/kit.js.
// Artwork: painted, imported with scripts/import-art.py (see docs/giant-art-prompts.md).

const { royal, icon, scatter } = require('../kit');

const A = '/games/tiki_titans/assets';
const plain = (file) => ({ image: `${A}/${file}`, plain: true });

module.exports = {
  id: 'tiki_titans',
  name: 'Tiki Titans',
  tagline: '9,600 ways · 2-4-5-6-5-4-2 grid · Full-reel Totem Wilds · Sticky x5–x5000 in Free Spins',
  category: 'tropical',
  mechanic: 'giants',
  reels_count: 7,
  rows_count: 6,
  reel_heights: [2, 4, 5, 6, 5, 4, 2],
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 50000,
  giants: {
    WILD: { height: 'reel' }, // grows over the whole reel it lands on
    SHARK: { height: 3 }
  },
  theme: {
    accent: '#ffb03a',
    bg1: '#0e5a5a',
    bg2: '#04181c',
    frame: 'none',
    particles: 'embers',
    font: 'Bungee',
    icon: '🗿',
    title: ['TIKI', 'TITANS'],
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    plainSymbols: true,
    symbolScale: 0.92,
    cover: `${A}/cover.jpg`,
    // painted cabinet: every reel sits in its own window (picture pixels, measured by scripts/import-art.py)
    stage: {
      image: `${A}/stage.jpg`,
      width: 1466,
      height: 1073,
      reels: { x: 305, y: 262, w: 858, h: 493 },
      pad: 0,
      reel_rects: [
        { x: 305, y: 426, w: 112, h: 183 },
        { x: 423, y: 365, w: 118, h: 299 },
        { x: 547, y: 309, w: 119, h: 400 },
        { x: 673, y: 262, w: 121, h: 493 },
        { x: 801, y: 309, w: 120, h: 400 },
        { x: 926, y: 365, w: 118, h: 299 },
        { x: 1050, y: 426, w: 113, h: 183 }
      ]
    }
  },
  symbols: {
    WILD: { id: 'WILD', name: 'Tiki Totem Wild', kind: 'wild', glyph: '🗿', color: '#ffb03a', isWild: true, giant: true, ...plain('wild_icon.png'), tall_image: `${A}/wild.png` },
    SCATTER: scatter('Volcano', '🌋', '#ff5a2a', plain('sym_scatter.png')),
    SHARK: icon('SHARK', 'Shark God', '🦈', '#3fa9d8', { giant: true, ...plain('shark_icon.png'), tall_image: `${A}/giant.png`, tall_video: [`${A}/giant.webm`, `${A}/giant.mp4`], tall_mask: `${A}/giant_mask.png`, badge_y: 0.885 }), // animated card; multiplier sits in its medallion
    TURTLE: icon('TURTLE', 'Sea Turtle', '🐢', '#4cc26a', plain('sym_turtle.png')),
    PARROT: icon('PARROT', 'Parrot', '🦜', '#e8452e', plain('sym_parrot.png')),
    SHELL: icon('SHELL', 'Conch Shell', '🐚', '#f3b48a', plain('sym_shell.png')),
    PINEAPPLE: icon('PINEAPPLE', 'Pineapple', '🍍', '#f5c542', plain('sym_pineapple.png')),
    A: { ...royal('A', '#ff5a3a'), ...plain('sym_a.png') },
    K: { ...royal('K', '#ffb03a'), ...plain('sym_k.png') },
    Q: { ...royal('Q', '#3ddc97'), ...plain('sym_q.png') },
    J: { ...royal('J', '#3db7ff'), ...plain('sym_j.png') },
    '10': { ...royal('10', '#c77dff'), ...plain('sym_10.png') }
  },
  // x coin value per way (coin = total bet / 20); 3 to 7 adjacent reels from the left
  paytable: {
    SHARK: { 3: 25, 4: 60, 5: 150, 6: 300, 7: 600 },
    TURTLE: { 3: 15, 4: 40, 5: 100, 6: 200, 7: 400 },
    PARROT: { 3: 12, 4: 30, 5: 80, 6: 160, 7: 320 },
    SHELL: { 3: 10, 4: 25, 5: 60, 6: 120, 7: 250 },
    PINEAPPLE: { 3: 6, 4: 15, 5: 40, 6: 80, 7: 160 },
    A: { 3: 5, 4: 12, 5: 30, 6: 60, 7: 120 },
    K: { 3: 4, 4: 10, 5: 25, 6: 50, 7: 100 },
    Q: { 3: 3, 4: 8, 5: 20, 6: 40, 7: 80 },
    J: { 3: 3, 4: 8, 5: 20, 6: 40, 7: 80 },
    '10': { 3: 2, 4: 6, 5: 15, 6: 30, 7: 60 },
    SCATTER: { 3: 2, 4: 10, 5: 50 }
  },
  // Giants: SHARK = number of 3-row blocks; WILD = number of totem cells (each grows over the reel).
  reels: [
    { WILD: 0, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 2, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 },
    { WILD: 1, SHARK: 1, SCATTER: 1, TURTLE: 5, PARROT: 6, SHELL: 6, PINEAPPLE: 9, A: 9, K: 10, Q: 10, J: 11, '10': 11 }
  ],
  // Free spins: 5x longer strips with the same single totem cell, so sticky totems arrive one by one
  // (their multipliers multiply together in a way — a board full of totems is the jackpot, not the norm).
  fs_reels: [
    { WILD: 0, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 },
    { WILD: 1, SHARK: 5, SCATTER: 1, TURTLE: 25, PARROT: 30, SHELL: 30, PINEAPPLE: 45, A: 45, K: 50, Q: 50, J: 55, '10': 55 }
  ],
  free_spins: {
    trigger: 3,
    spins: 10,
    retrigger_min: 3,
    retrigger_spins: 5,
    max_spins: 60,
    buy: true,
    sticky_giants: true,
    // Sticky Totem Wild: x5 … x5000 (weights — x5 is common, x5000 is extremely rare).
    // Sticky Shark God keeps x2 / x3 like the Princess of Enchanted Knight.
    sticky_multipliers: {
      WILD: { 5: 1000, 10: 420, 15: 200, 20: 120, 25: 80, 50: 36, 100: 14, 250: 5, 500: 2, 1000: 0.8, 2500: 0.25, 5000: 0.08 },
      SHARK: { 2: 60, 3: 40 }
    }
  },
  pay_scale: 1
};
