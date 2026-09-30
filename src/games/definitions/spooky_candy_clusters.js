// Spooky Sweet Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'spooky_candy_clusters',
  name: 'Spooky Sweet Clusters',
  tagline: '7x7 Haunted Treats · Ghostly Cascades · Multiplier Spots up to x1024',
  category: 'holiday',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/spooky_candy_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py spooky_candy_clusters
  theme: {
  "accent": "#ff7518",
  "bg1": "#231123",
  "bg2": "#0a040d",
  "frame": "none",
  "particles": "sparkle",
  "font": "Creepster",
  "icon": "🎃",
  "title": [
    "SPOOKY SWEET",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/spooky_candy_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/spooky_candy_clusters/assets/stage.jpg",
    "width": 1441,
    "height": 941,
    "reels": {
      "x": 393,
      "y": 272,
      "w": 655,
      "h": 598
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Jack-o-Lantern",
    "kind": "scatter",
    "glyph": "🎃",
    "color": "#ff7518",
    "image": "/games/spooky_candy_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "GHOST": {
    "id": "GHOST",
    "name": "Ghost Mallow",
    "kind": "icon",
    "glyph": "👻",
    "color": "#e0fbfc",
    "image": "/games/spooky_candy_clusters/assets/sym_ghost.png"
  },
  "CANDY_CORN": {
    "id": "CANDY_CORN",
    "name": "Candy Corn",
    "kind": "icon",
    "glyph": "🍬",
    "color": "#ffd166",
    "image": "/games/spooky_candy_clusters/assets/sym_candy_corn.png"
  },
  "GUMMY_BAT": {
    "id": "GUMMY_BAT",
    "name": "Gummy Bat",
    "kind": "icon",
    "glyph": "🦇",
    "color": "#9b5de5",
    "image": "/games/spooky_candy_clusters/assets/sym_gummy_bat.png"
  },
  "CARAMEL_APPLE": {
    "id": "CARAMEL_APPLE",
    "name": "Poison Apple",
    "kind": "icon",
    "glyph": "🍎",
    "color": "#d62828",
    "image": "/games/spooky_candy_clusters/assets/sym_caramel_apple.png"
  },
  "SKULL_DROP": {
    "id": "SKULL_DROP",
    "name": "Sugar Skull",
    "kind": "icon",
    "glyph": "💀",
    "color": "#f15bb5",
    "image": "/games/spooky_candy_clusters/assets/sym_skull_drop.png"
  },
  "POTION_TREAT": {
    "id": "POTION_TREAT",
    "name": "Witch Brew",
    "kind": "icon",
    "glyph": "🧪",
    "color": "#00f5d4",
    "image": "/games/spooky_candy_clusters/assets/sym_potion_treat.png"
  },
  "SPIDER_SWEET": {
    "id": "SPIDER_SWEET",
    "name": "Spider Bonbon",
    "kind": "icon",
    "glyph": "🕷️",
    "color": "#70e000",
    "image": "/games/spooky_candy_clusters/assets/sym_spider_sweet.png"
  }
},
  paytable: {
  "GHOST": {
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
  "CANDY_CORN": {
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
  "GUMMY_BAT": {
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
  "CARAMEL_APPLE": {
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
  "SKULL_DROP": {
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
  "POTION_TREAT": {
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
  "SPIDER_SWEET": {
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
  "GHOST": 150,
  "CANDY_CORN": 220,
  "GUMMY_BAT": 300,
  "CARAMEL_APPLE": 500,
  "SKULL_DROP": 650,
  "POTION_TREAT": 850,
  "SPIDER_SWEET": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "GHOST": 150,
  "CANDY_CORN": 220,
  "GUMMY_BAT": 300,
  "CARAMEL_APPLE": 500,
  "SKULL_DROP": 650,
  "POTION_TREAT": 950,
  "SPIDER_SWEET": 1350,
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
