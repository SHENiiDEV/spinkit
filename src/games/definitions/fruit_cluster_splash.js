// Fruit Cluster Splash — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'fruit_cluster_splash',
  name: 'Fruit Cluster Splash',
  tagline: '7x7 Fruit Grid · Splash Cascades · Multiplier Spots up to x1024',
  category: 'fruits',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/fruit_cluster_splash/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py fruit_cluster_splash
  theme: {
  "accent": "#ff9100",
  "bg1": "#6b1d4a",
  "bg2": "#170311",
  "frame": "none",
  "particles": "sparkle",
  "font": "Fredoka",
  "icon": "🍹",
  "title": [
    "FRUIT CLUSTER",
    "SPLASH"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/fruit_cluster_splash/assets/cover.jpg",
  "stage": {
    "image": "/games/fruit_cluster_splash/assets/stage.jpg",
    "width": 1353,
    "height": 911,
    "reels": {
      "x": 369,
      "y": 280,
      "w": 615,
      "h": 564
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Tropical Cocktail",
    "kind": "scatter",
    "glyph": "🍹",
    "color": "#ff9100",
    "image": "/games/fruit_cluster_splash/assets/sym_scatter.png",
    "isScatter": true
  },
  "PINEAPPLE": {
    "id": "PINEAPPLE",
    "name": "Golden Pineapple",
    "kind": "icon",
    "glyph": "🍍",
    "color": "#ffc107",
    "image": "/games/fruit_cluster_splash/assets/sym_pineapple.png"
  },
  "WATERMELON": {
    "id": "WATERMELON",
    "name": "Juicy Watermelon",
    "kind": "icon",
    "glyph": "🍉",
    "color": "#2e7d32",
    "image": "/games/fruit_cluster_splash/assets/sym_watermelon.png"
  },
  "STRAWBERRY": {
    "id": "STRAWBERRY",
    "name": "Sweet Strawberry",
    "kind": "icon",
    "glyph": "🍓",
    "color": "#e53935",
    "image": "/games/fruit_cluster_splash/assets/sym_strawberry.png"
  },
  "MANGO": {
    "id": "MANGO",
    "name": "Ripe Mango",
    "kind": "icon",
    "glyph": "🥭",
    "color": "#ff9800",
    "image": "/games/fruit_cluster_splash/assets/sym_mango.png"
  },
  "GRAPES": {
    "id": "GRAPES",
    "name": "Purple Grapes",
    "kind": "icon",
    "glyph": "🍇",
    "color": "#7b1fa2",
    "image": "/games/fruit_cluster_splash/assets/sym_grapes.png"
  },
  "KIWI": {
    "id": "KIWI",
    "name": "Fresh Kiwi",
    "kind": "icon",
    "glyph": "🥝",
    "color": "#7cb342",
    "image": "/games/fruit_cluster_splash/assets/sym_kiwi.png"
  },
  "BLUEBERRY": {
    "id": "BLUEBERRY",
    "name": "Wild Blueberry",
    "kind": "icon",
    "glyph": "🫐",
    "color": "#3949ab",
    "image": "/games/fruit_cluster_splash/assets/sym_blueberry.png"
  }
},
  paytable: {
  "PINEAPPLE": {
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
  "WATERMELON": {
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
  "STRAWBERRY": {
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
  "MANGO": {
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
  "GRAPES": {
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
  "KIWI": {
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
  "BLUEBERRY": {
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
  "PINEAPPLE": 150,
  "WATERMELON": 220,
  "STRAWBERRY": 300,
  "MANGO": 500,
  "GRAPES": 650,
  "KIWI": 850,
  "BLUEBERRY": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "PINEAPPLE": 150,
  "WATERMELON": 220,
  "STRAWBERRY": 300,
  "MANGO": 500,
  "GRAPES": 650,
  "KIWI": 950,
  "BLUEBERRY": 1350,
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
