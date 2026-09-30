// Cosmic Cluster Nova — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'cosmic_cluster_nova',
  name: 'Cosmic Cluster Nova',
  tagline: '7x7 Deep Space · Supernova Explosions · Multiplier Spots up to x1024',
  category: 'space',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/cosmic_cluster_nova/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py cosmic_cluster_nova
  theme: {
  "accent": "#00f0ff",
  "bg1": "#0a0a2a",
  "bg2": "#02020a",
  "frame": "none",
  "particles": "stars",
  "font": "Orbitron",
  "icon": "🪐",
  "title": [
    "COSMIC CLUSTER",
    "NOVA"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/cosmic_cluster_nova/assets/cover.jpg",
  "stage": {
    "image": "/games/cosmic_cluster_nova/assets/stage.jpg",
    "width": 1355,
    "height": 914,
    "reels": {
      "x": 370,
      "y": 300,
      "w": 616,
      "h": 549
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Supernova Burst",
    "kind": "scatter",
    "glyph": "💥",
    "color": "#ff007f",
    "image": "/games/cosmic_cluster_nova/assets/sym_scatter.png",
    "isScatter": true
  },
  "PLANET": {
    "id": "PLANET",
    "name": "Ringed Saturn",
    "kind": "icon",
    "glyph": "🪐",
    "color": "#ffd166",
    "image": "/games/cosmic_cluster_nova/assets/sym_planet.png"
  },
  "PULSAR": {
    "id": "PULSAR",
    "name": "Radiant Pulsar",
    "kind": "icon",
    "glyph": "⭐",
    "color": "#06d6a0",
    "image": "/games/cosmic_cluster_nova/assets/sym_pulsar.png"
  },
  "COMET": {
    "id": "COMET",
    "name": "Cosmic Comet",
    "kind": "icon",
    "glyph": "☄️",
    "color": "#118ab2",
    "image": "/games/cosmic_cluster_nova/assets/sym_comet.png"
  },
  "UFO_CRYSTAL": {
    "id": "UFO_CRYSTAL",
    "name": "Alien Shard",
    "kind": "icon",
    "glyph": "🛸",
    "color": "#9d4edd",
    "image": "/games/cosmic_cluster_nova/assets/sym_ufo_crystal.png"
  },
  "DARK_MATTER": {
    "id": "DARK_MATTER",
    "name": "Void Sphere",
    "kind": "icon",
    "glyph": "🔮",
    "color": "#7209b7",
    "image": "/games/cosmic_cluster_nova/assets/sym_dark_matter.png"
  },
  "STAR_GEM": {
    "id": "STAR_GEM",
    "name": "Nebula Gem",
    "kind": "icon",
    "glyph": "💎",
    "color": "#4cc9f0",
    "image": "/games/cosmic_cluster_nova/assets/sym_star_gem.png"
  },
  "SOLAR_FLARE": {
    "id": "SOLAR_FLARE",
    "name": "Solar Flare",
    "kind": "icon",
    "glyph": "☀️",
    "color": "#f72585",
    "image": "/games/cosmic_cluster_nova/assets/sym_solar_flare.png"
  }
},
  paytable: {
  "PLANET": {
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
  "PULSAR": {
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
  "COMET": {
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
  "UFO_CRYSTAL": {
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
  "DARK_MATTER": {
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
  "STAR_GEM": {
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
  "SOLAR_FLARE": {
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
  "PLANET": 150,
  "PULSAR": 220,
  "COMET": 300,
  "UFO_CRYSTAL": 500,
  "DARK_MATTER": 650,
  "STAR_GEM": 850,
  "SOLAR_FLARE": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "PLANET": 150,
  "PULSAR": 220,
  "COMET": 300,
  "UFO_CRYSTAL": 500,
  "DARK_MATTER": 650,
  "STAR_GEM": 950,
  "SOLAR_FLARE": 1350,
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
