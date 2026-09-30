// Dragon Egg Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'dragon_egg_clusters',
  name: 'Dragon Egg Clusters',
  tagline: '7x7 Dragon Lair · Elemental Hatching · Multiplier Spots up to x1024',
  category: 'mythology',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/dragon_egg_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py dragon_egg_clusters
  theme: {
  "accent": "#ff5500",
  "bg1": "#3d0c02",
  "bg2": "#120200",
  "frame": "none",
  "particles": "embers",
  "font": "Cinzel",
  "icon": "🥚",
  "title": [
    "DRAGON EGG",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/dragon_egg_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/dragon_egg_clusters/assets/stage.jpg",
    "width": 1369,
    "height": 977,
    "reels": {
      "x": 374,
      "y": 307,
      "w": 622,
      "h": 599
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Dragon Horn",
    "kind": "scatter",
    "glyph": "📯",
    "color": "#ffcc00",
    "image": "/games/dragon_egg_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "GOLD_EGG": {
    "id": "GOLD_EGG",
    "name": "Imperial Dragon Egg",
    "kind": "icon",
    "glyph": "🥚",
    "color": "#ffd700",
    "image": "/games/dragon_egg_clusters/assets/sym_gold_egg.png"
  },
  "FIRE_RUBY": {
    "id": "FIRE_RUBY",
    "name": "Inferno Fire Ruby",
    "kind": "icon",
    "glyph": "🔥",
    "color": "#ff1100",
    "image": "/games/dragon_egg_clusters/assets/sym_fire_ruby.png"
  },
  "ICE_CRYSTAL": {
    "id": "ICE_CRYSTAL",
    "name": "Frost Drake Shard",
    "kind": "icon",
    "glyph": "❄️",
    "color": "#66d9ff",
    "image": "/games/dragon_egg_clusters/assets/sym_ice_crystal.png"
  },
  "LIGHTNING_ORB": {
    "id": "LIGHTNING_ORB",
    "name": "Storm Dragon Pearl",
    "kind": "icon",
    "glyph": "⚡",
    "color": "#ffff66",
    "image": "/games/dragon_egg_clusters/assets/sym_lightning_orb.png"
  },
  "EARTH_STONE": {
    "id": "EARTH_STONE",
    "name": "Mountain Drake Rock",
    "kind": "icon",
    "glyph": "🪨",
    "color": "#8b5a2b",
    "image": "/games/dragon_egg_clusters/assets/sym_earth_stone.png"
  },
  "WIND_ORB": {
    "id": "WIND_ORB",
    "name": "Gale Dragon Orb",
    "kind": "icon",
    "glyph": "🌪️",
    "color": "#a6f4c5",
    "image": "/games/dragon_egg_clusters/assets/sym_wind_orb.png"
  },
  "POISON_FANG": {
    "id": "POISON_FANG",
    "name": "Wyvern Acid Fang",
    "kind": "icon",
    "glyph": "🧪",
    "color": "#39e75f",
    "image": "/games/dragon_egg_clusters/assets/sym_poison_fang.png"
  }
},
  paytable: {
  "GOLD_EGG": {
    "5": 1,
    "6": 1.5,
    "7": 2,
    "8": 3,
    "9": 4,
    "10": 5,
    "11": 7.5,
    "12": 10,
    "13": 15,
    "14": 25,
    "15": 50
  },
  "FIRE_RUBY": {
    "5": 0.75,
    "6": 1,
    "7": 1.5,
    "8": 2,
    "9": 3,
    "10": 4,
    "11": 5,
    "12": 7.5,
    "13": 10,
    "14": 15,
    "15": 30
  },
  "ICE_CRYSTAL": {
    "5": 0.5,
    "6": 0.75,
    "7": 1,
    "8": 1.5,
    "9": 2,
    "10": 3,
    "11": 4,
    "12": 5,
    "13": 7.5,
    "14": 10,
    "15": 20
  },
  "LIGHTNING_ORB": {
    "5": 0.4,
    "6": 0.5,
    "7": 0.75,
    "8": 1,
    "9": 1.5,
    "10": 2,
    "11": 3,
    "12": 4,
    "13": 5,
    "14": 7.5,
    "15": 15
  },
  "EARTH_STONE": {
    "5": 0.3,
    "6": 0.4,
    "7": 0.5,
    "8": 0.75,
    "9": 1,
    "10": 1.5,
    "11": 2,
    "12": 3,
    "13": 4,
    "14": 5,
    "15": 10
  },
  "WIND_ORB": {
    "5": 0.25,
    "6": 0.3,
    "7": 0.4,
    "8": 0.5,
    "9": 0.75,
    "10": 1,
    "11": 1.5,
    "12": 2,
    "13": 3,
    "14": 4,
    "15": 7.5
  },
  "POISON_FANG": {
    "5": 0.2,
    "6": 0.25,
    "7": 0.3,
    "8": 0.4,
    "9": 0.5,
    "10": 0.75,
    "11": 1,
    "12": 1.5,
    "13": 2,
    "14": 3,
    "15": 5
  }
},
  weights: {
  "GOLD_EGG": 150,
  "FIRE_RUBY": 220,
  "ICE_CRYSTAL": 300,
  "LIGHTNING_ORB": 500,
  "EARTH_STONE": 650,
  "WIND_ORB": 850,
  "POISON_FANG": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "GOLD_EGG": 150,
  "FIRE_RUBY": 220,
  "ICE_CRYSTAL": 300,
  "LIGHTNING_ORB": 500,
  "EARTH_STONE": 650,
  "WIND_ORB": 950,
  "POISON_FANG": 1350,
  "SCATTER": 18
},
  free_spins: {
    trigger: 3,
    spins: { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 },
    retrigger_min: 3,
    max_spins: 100,
    sticky_spots: true,
    buy: true,
    buy_cost: 162
  },
  pay_scale: 0.733
};
