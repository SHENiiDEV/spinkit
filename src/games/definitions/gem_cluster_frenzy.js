// Gem Cluster Frenzy — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'gem_cluster_frenzy',
  name: 'Gem Cluster Frenzy',
  tagline: '7x7 Grid · Exploding Gem Clusters · Multiplier Spots up to x1024',
  category: 'gems',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/gem_cluster_frenzy/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py gem_cluster_frenzy
  theme: {
  "accent": "#4fc3f7",
  "bg1": "#0d2748",
  "bg2": "#020814",
  "frame": "none",
  "particles": "sparkle",
  "font": "Cinzel",
  "icon": "💎",
  "title": [
    "GEM CLUSTER",
    "FRENZY"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/gem_cluster_frenzy/assets/cover.jpg",
  "stage": {
    "image": "/games/gem_cluster_frenzy/assets/stage.jpg",
    "width": 1237,
    "height": 932,
    "reels": {
      "x": 338,
      "y": 346,
      "w": 562,
      "h": 524
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Diamond Star",
    "kind": "scatter",
    "glyph": "💎",
    "color": "#4fc3f7",
    "image": "/games/gem_cluster_frenzy/assets/sym_scatter.png",
    "isScatter": true
  },
  "DIAMOND": {
    "id": "DIAMOND",
    "name": "Flawless Diamond",
    "kind": "icon",
    "glyph": "💠",
    "color": "#e0f7fa",
    "image": "/games/gem_cluster_frenzy/assets/sym_diamond.png"
  },
  "RUBY": {
    "id": "RUBY",
    "name": "Royal Ruby",
    "kind": "icon",
    "glyph": "❤️",
    "color": "#e53935",
    "image": "/games/gem_cluster_frenzy/assets/sym_ruby.png"
  },
  "EMERALD": {
    "id": "EMERALD",
    "name": "Sacred Emerald",
    "kind": "icon",
    "glyph": "💚",
    "color": "#43a047",
    "image": "/games/gem_cluster_frenzy/assets/sym_emerald.png"
  },
  "SAPPHIRE": {
    "id": "SAPPHIRE",
    "name": "Deep Sapphire",
    "kind": "icon",
    "glyph": "🔷",
    "color": "#1e88e5",
    "image": "/games/gem_cluster_frenzy/assets/sym_sapphire.png"
  },
  "AMETHYST": {
    "id": "AMETHYST",
    "name": "Imperial Amethyst",
    "kind": "icon",
    "glyph": "💜",
    "color": "#8e24aa",
    "image": "/games/gem_cluster_frenzy/assets/sym_amethyst.png"
  },
  "TOPAZ": {
    "id": "TOPAZ",
    "name": "Golden Topaz",
    "kind": "icon",
    "glyph": "🔶",
    "color": "#ffb300",
    "image": "/games/gem_cluster_frenzy/assets/sym_topaz.png"
  },
  "OPAL": {
    "id": "OPAL",
    "name": "Mystic Opal",
    "kind": "icon",
    "glyph": "🔮",
    "color": "#ab47bc",
    "image": "/games/gem_cluster_frenzy/assets/sym_opal.png"
  }
},
  paytable: {
  "DIAMOND": {
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
  "RUBY": {
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
  "EMERALD": {
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
  "SAPPHIRE": {
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
  "AMETHYST": {
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
  "TOPAZ": {
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
  "OPAL": {
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
  "DIAMOND": 150,
  "RUBY": 220,
  "EMERALD": 300,
  "SAPPHIRE": 500,
  "AMETHYST": 650,
  "TOPAZ": 850,
  "OPAL": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "DIAMOND": 150,
  "RUBY": 220,
  "EMERALD": 300,
  "SAPPHIRE": 500,
  "AMETHYST": 650,
  "TOPAZ": 950,
  "OPAL": 1350,
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
