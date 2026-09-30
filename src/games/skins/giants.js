/**
 * Skins of the GIANTS template (Enchanted Knight).
 *
 * Every skin reuses the template's reels, paytable, free spins, sticky multipliers and
 * calibration 1:1 — only names, graphics and theme change, so the math (RTP, hit rate,
 * FS frequency, max win) is exactly the same as Enchanted Knight.
 *
 * Roles (template symbol -> skin symbol):
 *   PRINCESS  -> giant   (3-row tall top symbol, sticky x2/x3 in FS)
 *   WILD      -> wild    (3-row tall Wild, sticky x1..x500 in FS)
 *   SCATTER   -> scatter
 *   SWAN, RING_BOX, DAGGER, LOVE_LETTER -> h[0..3] (icons, highest pay first)
 *   HEART_GEM, DIAMOND_GEM, STAR_GEM, MOON_GEM -> gems[0..3] (low pay gems)
 *
 * `art` is read by scripts/gen-art.js (scripts/art/games/giants.js), which paints the cabinet (stage.jpg) and the
 * two giant portraits (giant.png / wild.png) into public/games/<id>/assets/.
 * Painted artwork: set `custom_art: true`, put the files in public/games/<id>/assets/ and describe them
 * with `stage` (picture size + reel panel rect) and `images` (symbol PNGs); see cleopatra_giants.
 */
const GIANT_SKINS = [
  {
    id: 'cleopatra_giants',
    name: "Cleopatra's Fortune",
    cat: 'egypt',
    giant: ['Cleopatra', '👸🏽', '#f5c26b'],
    wild: ['Pharaoh Wild', '🤴🏽', '#ffd76a'],
    scatter: ['Golden Amphora', '🏺', '#ffb03a'],
    h: [['Sacred Cobra', '🐍', '#3ddc97'], ['Golden Scarab', '🪲', '#3fb8ff'], ['Desert Camel', '🐫', '#e0a15a'], ['Papyrus', '📜', '#f0d9a0']],
    gems: [['#e8283f', 'oval'], ['#22c46b', 'hex'], ['#9b3ff0', 'heart'], ['#2f7cf0', 'triangle']],
    look: { accent: '#ffcf4a', bg1: '#6b3a0c', bg2: '#140a02', font: 'Cinzel', particles: 'dust', title: ["CLEOPATRA'S", 'FORTUNE'] },
    // Painted artwork (supplied by Deve): cabinet, 9 symbols, 2 giant portraits. gen-art.js leaves it alone.
    custom_art: true,
    stage: { width: 1265, height: 930, reels: { x: 263, y: 272, w: 741, h: 537 }, pad: 6, symbol_scale: 1 },
    images: {
      scatter: 'sym_scatter.png',
      h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
      gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
    },
    art: {
      scene: 'pyramids', sky: ['#1b1036', '#b3462a', '#ffb45a'], sun: [700, 560, '#ffe39a'],
      frame: ['#fff1b8', '#d9a33a', '#6b4308'], panel: ['#1d3a4a', '#08141c'], pattern: 'scales',
      deco: '🌴', gem: '#35d0c0', giantBg: ['#ffcf7a', '#8a3a12'], wildBg: ['#ffe28a', '#5a2a08'],
      giantEmblem: '🐍', wildEmblem: '☀️', logo: ['#fff6c8', '#ffcf4a', '#8a5a06']
    }
  },
  {
    id: 'valhalla_giants',
    name: 'Valhalla Giants',
    cat: 'norse',
    giant: ['Valkyrie', '🧝‍♀️', '#9fd3ff'],
    wild: ['Thor Wild', '🧔‍♂️', '#7fb3ff'],
    scatter: ['Rune Shield', '🛡️', '#6ec3ff'],
    h: [['Battle Axe', '🪓', '#c9d3e0'], ['Grey Wolf', '🐺', '#9aa7b8'], ['Storm Eagle', '🦅', '#c79a5a'], ['Mead Horn', '🍯', '#ffb020']],
    gems: [['#6ec3ff', 'hex'], ['#b8f0ff', 'diamond'], ['#3fe0a0', 'octagon'], ['#c77dff', 'oval']],
    look: { accent: '#8fd0ff', bg1: '#1d3550', bg2: '#050b14', font: 'Russo One', particles: 'snow', title: ['VALHALLA', 'GIANTS'] },
    custom_art: true,
    stage: { width: 1200, height: 896, reels: { x: 218, y: 268, w: 764, h: 508 }, pad: 6, symbol_scale: 1 },
    images: {
      scatter: 'sym_scatter.png',
      h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
      gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
    },
    art: {
      scene: 'fjords', sky: ['#081426', '#1f4a70', '#8fc7e8'], sun: [980, 330, '#d8f4ff'],
      frame: ['#f2f7ff', '#8fa3bb', '#2c3a4d'], panel: ['#1a2c44', '#060d18'], pattern: 'runes',
      deco: '❄️', gem: '#6ec3ff', giantBg: ['#b8e4ff', '#1d4a78'], wildBg: ['#9fd0ff', '#10264a'],
      giantEmblem: '🛡️', wildEmblem: '⚡', logo: ['#ffffff', '#9fd8ff', '#2a5a8a']
    }
  },
  {
    id: 'pirate_queen_giants',
    name: "Pirate Queen's Gold",
    cat: 'pirates',
    giant: ['Pirate Queen', '👩‍🦰', '#ff8a5a'],
    wild: ['Captain Wild', '🧔', '#ffd23f'],
    scatter: ['Treasure Map', '🗺️', '#ffcf6a'],
    h: [['Parrot', '🦜', '#3ddc5a'], ['Anchor', '⚓', '#9fb4c8'], ['Gold Sack', '💰', '#ffcf3a'], ['Compass', '🧭', '#e05a3a']],
    gems: [['#e8283f', 'heart'], ['#2fbf71', 'octagon'], ['#2f7cf0', 'hex'], ['#9b3ff0', 'triangle']],
    look: { accent: '#ffcf3a', bg1: '#0d3b4f', bg2: '#03121a', font: 'Pirata One', particles: 'dust', title: ["PIRATE QUEEN'S", 'GOLD'] },
    custom_art: true,
    stage: { width: 1325, height: 1187, reels: { x: 271, y: 403, w: 784, h: 532 }, pad: 6, symbol_scale: 1 },
    images: {
      scatter: 'sym_scatter.png',
      h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
      gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
    },
    art: {
      scene: 'sea', sky: ['#0b1c3a', '#3a6a8a', '#ffb070'], sun: [420, 520, '#ffdca0'],
      frame: ['#f0c98a', '#8a5a2a', '#3a2008'], panel: ['#3a1a0a', '#120602'], pattern: 'planks',
      deco: '🏴‍☠️', gem: '#e8283f', giantBg: ['#ff9a6a', '#5a1a10'], wildBg: ['#ffd26a', '#4a2a08'],
      giantEmblem: '🏴‍☠️', wildEmblem: '💀', logo: ['#fff0c0', '#ffc23a', '#7a4a06']
    }
  },
  {
    id: 'olympus_titans',
    name: 'Olympus Titans',
    cat: 'mythology',
    giant: ['Athena', '👸', '#e8d6ff'],
    wild: ['Zeus Wild', '🧙‍♂️', '#ffe066'],
    scatter: ['Temple', '🏛️', '#ffe9a8'],
    h: [['Golden Eagle', '🦅', '#ffcf6a'], ['Sacred Grapes', '🍇', '#9b3ff0'], ['Amphora', '🏺', '#e08a4a'], ['Olympic Coin', '🪙', '#ffd23f']],
    gems: [['#2f7cf0', 'oval'], ['#e8283f', 'diamond'], ['#22c46b', 'octagon'], ['#9b3ff0', 'heart']],
    look: { accent: '#ffe066', bg1: '#2a2a6a', bg2: '#08081c', font: 'Cinzel', particles: 'sparkle', title: ['OLYMPUS', 'TITANS'] },
    custom_art: true,
    stage: { width: 1024, height: 917, reels: { x: 213, y: 297, w: 597, h: 415 }, pad: 6, symbol_scale: 1 },
    images: {
      scatter: 'sym_scatter.png',
      h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
      gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
    },
    art: {
      scene: 'temple', sky: ['#14124a', '#5a4ab0', '#ffd0a0'], sun: [700, 380, '#fff0c8'],
      frame: ['#ffffff', '#d8d2e8', '#7a6aa0'], panel: ['#241a5a', '#0a0620'], pattern: 'meander',
      deco: '🌿', gem: '#ffd23f', giantBg: ['#e8d6ff', '#3a2a8a'], wildBg: ['#fff0a0', '#3a2a6a'],
      giantEmblem: '🦉', wildEmblem: '⚡', logo: ['#ffffff', '#ffe066', '#8a6a10']
    }
  },
  {
    id: 'sakura_blade_giants',
    name: 'Sakura Blade',
    cat: 'asian',
    giant: ['Geisha', '👩', '#ff9ec7'],
    wild: ['Samurai Wild', '🥷', '#ff4d4d'],
    scatter: ['Pagoda', '🏯', '#ff6a8a'],
    h: [['Red Dragon', '🐉', '#3ddc97'], ['Torii Gate', '⛩️', '#ff4d3d'], ['Silk Fan', '🪭', '#ff7ab8'], ['Green Tea', '🍵', '#9ae06a']],
    gems: [['#ff5fa2', 'heart'], ['#3db7ff', 'hex'], ['#ffd23f', 'triangle'], ['#9b3ff0', 'oval']],
    look: { accent: '#ff7ab8', bg1: '#5a1030', bg2: '#12040a', font: 'Bangers', particles: 'petals', title: ['SAKURA', 'BLADE'] },
    custom_art: true,
    stage: { width: 1200, height: 896, reels: { x: 300, y: 300, w: 600, h: 415 }, pad: 6, symbol_scale: 1 },
    images: {
      scatter: 'sym_scatter.png',
      h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
      gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
    },
    art: {
      scene: 'pagoda', sky: ['#2a0a2a', '#b03a5a', '#ffc0a0'], sun: [980, 420, '#ffe0d0'],
      frame: ['#ff8a7a', '#b0202a', '#3a0508'], panel: ['#1a0a12', '#050204'], pattern: 'waves',
      deco: '🌸', gem: '#ff5fa2', giantBg: ['#ffc6dc', '#8a1a4a'], wildBg: ['#ff8a6a', '#3a0508'],
      giantEmblem: '🌸', wildEmblem: '⚔️', logo: ['#ffffff', '#ff9ec7', '#8a0a3a']
    }
  },
  {
    id: 'blood_moon_giants',
    name: 'Blood Moon Castle',
    cat: 'horror',
    giant: ['Countess', '🧛‍♀️', '#ff4a6a'],
    wild: ['Dracula Wild', '🧛‍♂️', '#c0203a'],
    scatter: ['Blood Moon', '🌕', '#ff3a3a'],
    h: [['Vampire Bat', '🦇', '#9a6ad0'], ['Blood Wine', '🍷', '#c0203a'], ['Coffin', '⚰️', '#a07a5a'], ['Candle', '🕯️', '#ffd27a']],
    gems: [['#e8283f', 'heart'], ['#9b3ff0', 'oval'], ['#3a3a4a', 'hex'], ['#c0c8d8', 'diamond']],
    look: { accent: '#ff3a4a', bg1: '#3a0612', bg2: '#060104', font: 'Creepster', particles: 'embers', title: ['BLOOD MOON', 'CASTLE'] },
    stage: { width: 1024, height: 917, reels: { x: 186, y: 332, w: 650, h: 438 }, pad: 6, symbol_scale: 1 },
    art: {
      scene: 'gothic', sky: ['#050208', '#3a0612', '#7a1020'], sun: [1000, 300, '#ff5a4a'],
      frame: ['#d8d8e0', '#5a5a6a', '#141418'], panel: ['#2a0610', '#080104'], pattern: 'damask',
      deco: '🥀', gem: '#e8283f', giantBg: ['#ff6a8a', '#2a0410'], wildBg: ['#c0203a', '#12020a'],
      giantEmblem: '🥀', wildEmblem: '🦇', logo: ['#ffffff', '#ff4a5a', '#5a0010']
    }
  },
  {
    id: 'sheriff_showdown_giants',
    name: "Sheriff's Showdown",
    cat: 'western',
    giant: ['Cowgirl', '👩‍🌾', '#ffb86a'],
    wild: ['Sheriff Wild', '🤠', '#ffcf3a'],
    scatter: ['Cactus', '🌵', '#3ddc5a'],
    h: [['Mustang', '🐎', '#b0703a'], ['Cowboy Boot', '👢', '#8a4a2a'], ['Gold Bag', '💰', '#ffcf3a'], ['Banjo', '🪕', '#e0a15a']],
    gems: [['#ffb020', 'triangle'], ['#e8283f', 'heart'], ['#35d0c0', 'oval'], ['#b0703a', 'hex']],
    look: { accent: '#ffb23f', bg1: '#8a3a12', bg2: '#1a0802', font: 'Rye', particles: 'dust', title: ["SHERIFF'S", 'SHOWDOWN'] },
    art: {
      scene: 'desert', sky: ['#3a1a4a', '#e0602a', '#ffd070'], sun: [700, 600, '#fff0b0'],
      frame: ['#f0c08a', '#9a5a2a', '#3a1a06'], panel: ['#3a1a0a', '#140802'], pattern: 'planks',
      deco: '🌵', gem: '#ffb020', giantBg: ['#ffc07a', '#6a2a0a'], wildBg: ['#ffd66a', '#5a3008'],
      giantEmblem: '🐎', wildEmblem: '⭐', logo: ['#fff0c8', '#ffb23f', '#6a3006']
    }
  },
  {
    id: 'poseidon_pearls_giants',
    name: "Poseidon's Pearls",
    cat: 'ocean',
    giant: ['Mermaid', '🧜‍♀️', '#5ae0d0'],
    wild: ['Poseidon Wild', '🧜‍♂️', '#3aa0ff'],
    scatter: ['Magic Shell', '🐚', '#ffb0c8'],
    h: [['Octopus', '🐙', '#ff6a8a'], ['Dolphin', '🐬', '#3ab0ff'], ['Tropical Fish', '🐠', '#ffb020'], ['Crab', '🦀', '#ff4a3a']],
    gems: [['#35d0c0', 'oval'], ['#2f7cf0', 'hex'], ['#ff7ab8', 'heart'], ['#e8f4ff', 'octagon']],
    look: { accent: '#5ae0e0', bg1: '#0a4a6a', bg2: '#02121e', font: 'Lobster', particles: 'bubbles', title: ["POSEIDON'S", 'PEARLS'] },
    art: {
      scene: 'underwater', sky: ['#021a30', '#0a5a8a', '#3ac0d8'], sun: [700, 60, '#c8fff8'],
      frame: ['#fff0f4', '#e0a8b8', '#6a3a4a'], panel: ['#063048', '#021018'], pattern: 'scales',
      deco: '🐚', gem: '#35d0c0', giantBg: ['#8af0e8', '#0a3a5a'], wildBg: ['#6ab8ff', '#0a1a4a'],
      giantEmblem: '🐚', wildEmblem: '🔱', logo: ['#ffffff', '#6af0f0', '#0a4a7a']
    }
  },
  {
    id: 'star_pilots_giants',
    name: 'Star Pilots',
    cat: 'space',
    giant: ['Star Pilot', '👩‍🚀', '#c8d8ff'],
    wild: ['Android Wild', '🤖', '#3dffd0'],
    scatter: ['Ringed Planet', '🪐', '#ffb86a'],
    h: [['UFO', '🛸', '#3dffd0'], ['Rocket', '🚀', '#ff5a5a'], ['Satellite', '🛰️', '#c0c8d8'], ['Comet', '☄️', '#ffb020']],
    gems: [['#3dffd0', 'hex'], ['#ff2bd6', 'diamond'], ['#2f7cf0', 'octagon'], ['#ffd23f', 'triangle']],
    look: { accent: '#3dffd0', bg1: '#1a0a4a', bg2: '#02010a', font: 'Orbitron', particles: 'stars', title: ['STAR', 'PILOTS'] },
    art: {
      scene: 'space', sky: ['#02010a', '#1a0a4a', '#4a1a7a'], sun: [1050, 280, '#ffb0ff'],
      frame: ['#e8faff', '#5a7aa0', '#141c30'], panel: ['#0a0a2a', '#02020a'], pattern: 'hex',
      deco: '✨', gem: '#3dffd0', giantBg: ['#b0c8ff', '#1a1a5a'], wildBg: ['#5affe0', '#0a2a3a'],
      giantEmblem: '🌟', wildEmblem: '⚙️', logo: ['#ffffff', '#3dffd0', '#1a3a8a']
    }
  }
];

module.exports = { GIANT_SKINS };
