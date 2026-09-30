// Wolf Moon Hold & Win — HOLD & WIN 5x3, 20 lines
// Reference game for the reusable 'holdwin' mechanic (src/engine/mechanics/holdwin.js):
// money coins, 6+ coins start 3 respins (reset on every new coin), Collector & Booster coins,
// MINI / MINOR / MAJOR coins and the GRAND for a full screen.

const { LINES_5x3_20, royal, icon, wild, reels } = require('../kit');

module.exports = {
  id: 'wolf_moon_holdwin',
  name: 'Wolf Moon Hold & Win',
  tagline: '20 lines · Hold & Win respins · Collector & Booster coins · Full Moon jackpot',
  category: 'animals',
  mechanic: 'holdwin',
  reels_count: 5,
  rows_count: 3,
  paylines: LINES_5x3_20,
  volatility: 'high',
  max_win_x: 5000,
  // Artwork: scripts/gen-art.js wolf_moon_holdwin (coins are drawn live by the client)
  theme: {
    accent: '#ffd23f', bg1: '#1a2a5a', bg2: '#050814', frame: 'none', particles: 'stars',
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], title: ['WOLF MOON', 'HOLD & WIN'], icon: '🐺', font: 'Cinzel',
    plainSymbols: true,
    symbolScale: 0.95,
    cover: '/games/wolf_moon_holdwin/assets/cover.jpg',
    stage: { image: '/games/wolf_moon_holdwin/assets/stage.jpg', width: 1400, height: 1050, reels: { x: 240, y: 318, w: 920, h: 552 }, pad: 4 }
  },
  symbols: {
    WILD: wild('Howling Wolf Wild', '🐺', '#9fb8ff', { image: '/games/wolf_moon_holdwin/assets/sym_wild.png' }),
    COIN: { id: 'COIN', name: 'Moon Coin', kind: 'coin', glyph: '🌕', color: '#ffd23f' },
    BISON: icon('BISON', 'Bison', '🦬', '#b0703a', { image: '/games/wolf_moon_holdwin/assets/sym_bison.png' }),
    BEAR: icon('BEAR', 'Grizzly', '🐻', '#8a5a3a', { image: '/games/wolf_moon_holdwin/assets/sym_bear.png' }),
    EAGLE: icon('EAGLE', 'Eagle', '🦅', '#e0a15a', { image: '/games/wolf_moon_holdwin/assets/sym_eagle.png' }),
    DEER: icon('DEER', 'Deer', '🦌', '#c9884a', { image: '/games/wolf_moon_holdwin/assets/sym_deer.png' }),
    A: royal('A', '#ff5a5a'), K: royal('K', '#ffb23f'), Q: royal('Q', '#3ddc97'), J: royal('J', '#3db7ff'), '10': royal('10', '#c77dff')
  },
  paytable: {
    WILD: { 2: 5, 3: 75, 4: 300, 5: 1500 },
    BISON: { 3: 60, 4: 225, 5: 750 },
    BEAR: { 3: 45, 4: 150, 5: 450 },
    EAGLE: { 3: 36, 4: 120, 5: 360 },
    DEER: { 3: 30, 4: 90, 5: 300 },
    A: { 3: 15, 4: 45, 5: 150 }, K: { 3: 15, 4: 45, 5: 150 }, Q: { 3: 12, 4: 30, 5: 120 }, J: { 3: 12, 4: 30, 5: 120 }, '10': { 3: 9, 4: 24, 5: 90 }
  },
reels: reels(5, { WILD: 2, COIN: 8, BISON: 4, BEAR: 5, EAGLE: 5, DEER: 6, A: 8, K: 8, Q: 9, J: 9, '10': 10 }, { 0: { WILD: 0 } }),
  holdwin: {
    trigger: 6,
    respins: 3,
    land_chance: 700,
    values: { 1: 260, 2: 240, 3: 180, 5: 130, 8: 70, 10: 50, 15: 26, 25: 12, 50: 5, 100: 1 },
    jackpots: { MINI: 20, MINOR: 50, MAJOR: 250, GRAND: 1000 },
    jackpot_names: { MINI: 'COPPER', MINOR: 'SILVER', MAJOR: 'GOLD', GRAND: 'FULL MOON' }, // shown to players
    jackpot_weights: { MINI: 8, MINOR: 3, MAJOR: 1 },
    specials: { COLLECT: 14, BOOST: 7 }
  },
  free_spins: { buy: true },
  pay_scale: 1
};
