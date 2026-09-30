// Farm Harvest Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'lucky_farm_clusters',
  name: 'Farm Harvest Clusters',
  tagline: '7x7 Sunny Farm · Mega Crop Cascades · Multiplier Spots up to x1024',
  category: 'nature',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/lucky_farm_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py lucky_farm_clusters
  theme: {
  "accent": "#ffbb00",
  "bg1": "#2d5a27",
  "bg2": "#0a1c07",
  "frame": "none",
  "particles": "leaves",
  "font": "Bungee",
  "icon": "🚜",
  "title": [
    "FARM HARVEST",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/lucky_farm_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/lucky_farm_clusters/assets/stage.jpg",
    "width": 1391,
    "height": 1003,
    "reels": {
      "x": 380,
      "y": 300,
      "w": 632,
      "h": 628
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Golden Tractor",
    "kind": "scatter",
    "glyph": "🚜",
    "color": "#ffbb00",
    "image": "/games/lucky_farm_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "APPLE": {
    "id": "APPLE",
    "name": "Crisp Red Apple",
    "kind": "icon",
    "glyph": "🍎",
    "color": "#e63946",
    "image": "/games/lucky_farm_clusters/assets/sym_apple.png"
  },
  "CORN": {
    "id": "CORN",
    "name": "Sweet Golden Corn",
    "kind": "icon",
    "glyph": "🌽",
    "color": "#ffb703",
    "image": "/games/lucky_farm_clusters/assets/sym_corn.png"
  },
  "PUMPKIN": {
    "id": "PUMPKIN",
    "name": "Harvest Pumpkin",
    "kind": "icon",
    "glyph": "🎃",
    "color": "#fb8500",
    "image": "/games/lucky_farm_clusters/assets/sym_pumpkin.png"
  },
  "TOMATO": {
    "id": "TOMATO",
    "name": "Ripe Tomato",
    "kind": "icon",
    "glyph": "🍅",
    "color": "#d62828",
    "image": "/games/lucky_farm_clusters/assets/sym_tomato.png"
  },
  "CARROT": {
    "id": "CARROT",
    "name": "Crunchy Carrot",
    "kind": "icon",
    "glyph": "🥕",
    "color": "#f77f00",
    "image": "/games/lucky_farm_clusters/assets/sym_carrot.png"
  },
  "CUCUMBER": {
    "id": "CUCUMBER",
    "name": "Garden Cucumber",
    "kind": "icon",
    "glyph": "🥒",
    "color": "#588157",
    "image": "/games/lucky_farm_clusters/assets/sym_cucumber.png"
  },
  "EGGPLANT": {
    "id": "EGGPLANT",
    "name": "Royal Eggplant",
    "kind": "icon",
    "glyph": "🍆",
    "color": "#7209b7",
    "image": "/games/lucky_farm_clusters/assets/sym_eggplant.png"
  }
},
  paytable: {
  "APPLE": {
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
  "CORN": {
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
  "PUMPKIN": {
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
  "TOMATO": {
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
  "CARROT": {
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
  "CUCUMBER": {
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
  "EGGPLANT": {
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
  "APPLE": 150,
  "CORN": 220,
  "PUMPKIN": 300,
  "TOMATO": 500,
  "CARROT": 650,
  "CUCUMBER": 850,
  "EGGPLANT": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "APPLE": 150,
  "CORN": 220,
  "PUMPKIN": 300,
  "TOMATO": 500,
  "CARROT": 650,
  "CUCUMBER": 950,
  "EGGPLANT": 1350,
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
