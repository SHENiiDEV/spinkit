// Coral Reef Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'ocean_coral_clusters',
  name: 'Coral Reef Clusters',
  tagline: '7x7 Deep Lagoon · Coral Cascades · Multiplier Spots up to x1024',
  category: 'ocean',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/ocean_coral_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py ocean_coral_clusters
  theme: {
  "accent": "#00e5ff",
  "bg1": "#002b49",
  "bg2": "#000c19",
  "frame": "none",
  "particles": "sparkle",
  "font": "Cinzel",
  "icon": "🦪",
  "title": [
    "CORAL REEF",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/ocean_coral_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/ocean_coral_clusters/assets/stage.jpg",
    "width": 1395,
    "height": 1000,
    "reels": {
      "x": 381,
      "y": 298,
      "w": 634,
      "h": 627
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Giant Pearl Clam",
    "kind": "scatter",
    "glyph": "🦪",
    "color": "#ffffff",
    "image": "/games/ocean_coral_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "SEAHORSE": {
    "id": "SEAHORSE",
    "name": "Golden Seahorse",
    "kind": "icon",
    "glyph": "🪙",
    "color": "#ffd700",
    "image": "/games/ocean_coral_clusters/assets/sym_seahorse.png"
  },
  "CLOWNFISH": {
    "id": "CLOWNFISH",
    "name": "Tropic Clownfish",
    "kind": "icon",
    "glyph": "🐠",
    "color": "#ff6600",
    "image": "/games/ocean_coral_clusters/assets/sym_clownfish.png"
  },
  "TURTLE": {
    "id": "TURTLE",
    "name": "Ancient Sea Turtle",
    "kind": "icon",
    "glyph": "🐢",
    "color": "#2ec4b6",
    "image": "/games/ocean_coral_clusters/assets/sym_turtle.png"
  },
  "STARFISH": {
    "id": "STARFISH",
    "name": "Coral Starfish",
    "kind": "icon",
    "glyph": "⭐",
    "color": "#ff0066",
    "image": "/games/ocean_coral_clusters/assets/sym_starfish.png"
  },
  "JELLYFISH": {
    "id": "JELLYFISH",
    "name": "Glowing Jellyfish",
    "kind": "icon",
    "glyph": "🪼",
    "color": "#b5179e",
    "image": "/games/ocean_coral_clusters/assets/sym_jellyfish.png"
  },
  "NAUTILUS": {
    "id": "NAUTILUS",
    "name": "Spiral Shell",
    "kind": "icon",
    "glyph": "🐚",
    "color": "#ffaa00",
    "image": "/games/ocean_coral_clusters/assets/sym_nautilus.png"
  },
  "CORAL": {
    "id": "CORAL",
    "name": "Pink Reef Coral",
    "kind": "icon",
    "glyph": "🪸",
    "color": "#ff4d6d",
    "image": "/games/ocean_coral_clusters/assets/sym_coral.png"
  }
},
  paytable: {
  "SEAHORSE": {
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
  "CLOWNFISH": {
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
  "TURTLE": {
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
  "STARFISH": {
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
  "JELLYFISH": {
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
  "NAUTILUS": {
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
  "CORAL": {
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
  "SEAHORSE": 150,
  "CLOWNFISH": 220,
  "TURTLE": 300,
  "STARFISH": 500,
  "JELLYFISH": 650,
  "NAUTILUS": 850,
  "CORAL": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "SEAHORSE": 150,
  "CLOWNFISH": 220,
  "TURTLE": 300,
  "STARFISH": 500,
  "JELLYFISH": 650,
  "NAUTILUS": 950,
  "CORAL": 1350,
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
