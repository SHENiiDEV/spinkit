// Jungle Totem Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'jungle_totem_clusters',
  name: 'Jungle Totem Clusters',
  tagline: '7x7 Grid · Ancient Totem Tumbles · Multiplier Spots up to x1024',
  category: 'jungle',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/jungle_totem_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py jungle_totem_clusters
  theme: {
  "accent": "#ffd23f",
  "bg1": "#1b4332",
  "bg2": "#081c15",
  "frame": "none",
  "particles": "leaves",
  "font": "Cinzel",
  "icon": "🗿",
  "title": [
    "JUNGLE TOTEM",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/jungle_totem_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/jungle_totem_clusters/assets/stage.jpg",
    "width": 1388,
    "height": 1018,
    "reels": {
      "x": 379,
      "y": 327,
      "w": 631,
      "h": 617
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Sun Temple",
    "kind": "scatter",
    "glyph": "🏛️",
    "color": "#ffd23f",
    "image": "/games/jungle_totem_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "GOLD_MASK": {
    "id": "GOLD_MASK",
    "name": "Golden Mask",
    "kind": "icon",
    "glyph": "🎭",
    "color": "#ffb703",
    "image": "/games/jungle_totem_clusters/assets/sym_gold_mask.png"
  },
  "SERPENT": {
    "id": "SERPENT",
    "name": "Emerald Serpent",
    "kind": "icon",
    "glyph": "🐍",
    "color": "#2ec4b6",
    "image": "/games/jungle_totem_clusters/assets/sym_serpent.png"
  },
  "MACAW": {
    "id": "MACAW",
    "name": "Fire Macaw",
    "kind": "icon",
    "glyph": "🦜",
    "color": "#e71d36",
    "image": "/games/jungle_totem_clusters/assets/sym_macaw.png"
  },
  "JAGUAR": {
    "id": "JAGUAR",
    "name": "Shadow Jaguar",
    "kind": "icon",
    "glyph": "🐆",
    "color": "#f77f00",
    "image": "/games/jungle_totem_clusters/assets/sym_jaguar.png"
  },
  "JADE_IDOL": {
    "id": "JADE_IDOL",
    "name": "Jade Totem",
    "kind": "icon",
    "glyph": "🗿",
    "color": "#52b788",
    "image": "/games/jungle_totem_clusters/assets/sym_jade_idol.png"
  },
  "DRUM": {
    "id": "DRUM",
    "name": "Tribal Drum",
    "kind": "icon",
    "glyph": "🪘",
    "color": "#b56576",
    "image": "/games/jungle_totem_clusters/assets/sym_drum.png"
  },
  "FLOWER": {
    "id": "FLOWER",
    "name": "Jungle Orchid",
    "kind": "icon",
    "glyph": "🌺",
    "color": "#e056fd",
    "image": "/games/jungle_totem_clusters/assets/sym_flower.png"
  }
},
  paytable: {
  "GOLD_MASK": {
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
  "SERPENT": {
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
  "MACAW": {
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
  "JAGUAR": {
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
  "JADE_IDOL": {
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
  "DRUM": {
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
  "FLOWER": {
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
  "GOLD_MASK": 150,
  "SERPENT": 220,
  "MACAW": 300,
  "JAGUAR": 500,
  "JADE_IDOL": 650,
  "DRUM": 850,
  "FLOWER": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "GOLD_MASK": 150,
  "SERPENT": 220,
  "MACAW": 300,
  "JAGUAR": 500,
  "JADE_IDOL": 650,
  "DRUM": 950,
  "FLOWER": 1350,
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
