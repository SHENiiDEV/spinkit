// Cyber Cluster 2099 — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'neon_cyber_clusters',
  name: 'Cyber Cluster 2099',
  tagline: '7x7 Cyber Matrix · Digital Cluster Pay · Multiplier Spots up to x1024',
  category: 'scifi',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/neon_cyber_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py neon_cyber_clusters
  theme: {
  "accent": "#00ffcc",
  "bg1": "#120e2e",
  "bg2": "#03020a",
  "frame": "none",
  "particles": "neon",
  "font": "Orbitron",
  "icon": "💽",
  "title": [
    "CYBER CLUSTER",
    "2099"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/neon_cyber_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/neon_cyber_clusters/assets/stage.jpg",
    "width": 1278,
    "height": 974,
    "reels": {
      "x": 349,
      "y": 318,
      "w": 581,
      "h": 586
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Quantum Core",
    "kind": "scatter",
    "glyph": "💽",
    "color": "#00ffcc",
    "image": "/games/neon_cyber_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "HOLO_CUBE": {
    "id": "HOLO_CUBE",
    "name": "Holo Tesseract",
    "kind": "icon",
    "glyph": "🧊",
    "color": "#00f0ff",
    "image": "/games/neon_cyber_clusters/assets/sym_holo_cube.png"
  },
  "CYBER_HEX": {
    "id": "CYBER_HEX",
    "name": "Cyber Node",
    "kind": "icon",
    "glyph": "💠",
    "color": "#ff007f",
    "image": "/games/neon_cyber_clusters/assets/sym_cyber_hex.png"
  },
  "LASER_PYRAMID": {
    "id": "LASER_PYRAMID",
    "name": "Laser Apex",
    "kind": "icon",
    "glyph": "🔺",
    "color": "#ff3366",
    "image": "/games/neon_cyber_clusters/assets/sym_laser_pyramid.png"
  },
  "DATA_ORB": {
    "id": "DATA_ORB",
    "name": "Pulse Sphere",
    "kind": "icon",
    "glyph": "🔮",
    "color": "#9933ff",
    "image": "/games/neon_cyber_clusters/assets/sym_data_orb.png"
  },
  "NEON_STAR": {
    "id": "NEON_STAR",
    "name": "Matrix Star",
    "kind": "icon",
    "glyph": "⭐",
    "color": "#ffff00",
    "image": "/games/neon_cyber_clusters/assets/sym_neon_star.png"
  },
  "BIT_CHIP": {
    "id": "BIT_CHIP",
    "name": "Microchip",
    "kind": "icon",
    "glyph": "🪙",
    "color": "#33ff33",
    "image": "/games/neon_cyber_clusters/assets/sym_bit_chip.png"
  },
  "DATA_NODE": {
    "id": "DATA_NODE",
    "name": "Data Bit",
    "kind": "icon",
    "glyph": "🟣",
    "color": "#ff00cc",
    "image": "/games/neon_cyber_clusters/assets/sym_data_node.png"
  }
},
  paytable: {
  "HOLO_CUBE": {
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
  "CYBER_HEX": {
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
  "LASER_PYRAMID": {
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
  "DATA_ORB": {
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
  "NEON_STAR": {
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
  "BIT_CHIP": {
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
  "DATA_NODE": {
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
  "HOLO_CUBE": 150,
  "CYBER_HEX": 220,
  "LASER_PYRAMID": 300,
  "DATA_ORB": 500,
  "NEON_STAR": 650,
  "BIT_CHIP": 850,
  "DATA_NODE": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "HOLO_CUBE": 150,
  "CYBER_HEX": 220,
  "LASER_PYRAMID": 300,
  "DATA_ORB": 500,
  "NEON_STAR": 650,
  "BIT_CHIP": 950,
  "DATA_NODE": 1350,
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
