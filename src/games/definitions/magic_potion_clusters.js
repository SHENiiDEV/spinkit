// Potion Craft Clusters — Cluster Pays 7x7
// Generated from sweet_spot_mania reference template.

const { icon, scatter } = require('../kit');

module.exports = {
  id: 'magic_potion_clusters',
  name: 'Potion Craft Clusters',
  tagline: '7x7 Grid · Alchemy Cascades · Multiplier Spots up to x1024',
  category: 'fantasy',
  mechanic: 'clusters',
  calibration_from: 'sweet_spot_mania', // same paytable & weights as the calibrated template
  reels_count: 7,
  rows_count: 7,
  bet_multiplier: 20,
  volatility: 'very high',
  max_win_x: 10000,
  min_cluster: 5,
  spots: { max: 1024 },
  // Artwork: art-src/magic_potion_clusters/ (3x3 symbol sheet + cabinet) → python3 scripts/import-ai-art.py magic_potion_clusters
  theme: {
  "accent": "#d6a8ff",
  "bg1": "#2a0845",
  "bg2": "#0b001a",
  "frame": "none",
  "particles": "sparkle",
  "font": "Cinzel",
  "icon": "🧪",
  "title": [
    "POTION CRAFT",
    "CLUSTERS"
  ],
  "reelBg": [
    "rgba(0,0,0,0)",
    "rgba(0,0,0,0)"
  ],
  "plainSymbols": true,
  "symbolScale": 0.92,
  "cover": "/games/magic_potion_clusters/assets/cover.jpg",
  "stage": {
    "image": "/games/magic_potion_clusters/assets/stage.jpg",
    "width": 1448,
    "height": 924,
    "reels": {
      "x": 391,
      "y": 245,
      "w": 671,
      "h": 607
    },
    "pad": 8
  }
},
  symbols: {
  "SCATTER": {
    "id": "SCATTER",
    "name": "Grimoire Spellbook",
    "kind": "scatter",
    "glyph": "📖",
    "color": "#ffd23f",
    "image": "/games/magic_potion_clusters/assets/sym_scatter.png",
    "isScatter": true
  },
  "ELIXIR": {
    "id": "ELIXIR",
    "name": "Elixir of Life",
    "kind": "icon",
    "glyph": "🧪",
    "color": "#00e5ff",
    "image": "/games/magic_potion_clusters/assets/sym_elixir.png"
  },
  "DRAGON_POTION": {
    "id": "DRAGON_POTION",
    "name": "Dragon Brew",
    "kind": "icon",
    "glyph": "🍷",
    "color": "#d50000",
    "image": "/games/magic_potion_clusters/assets/sym_dragon_potion.png"
  },
  "CAULDRON": {
    "id": "CAULDRON",
    "name": "Mystic Cauldron",
    "kind": "icon",
    "glyph": "🫕",
    "color": "#aa00ff",
    "image": "/games/magic_potion_clusters/assets/sym_cauldron.png"
  },
  "MANA_FLASK": {
    "id": "MANA_FLASK",
    "name": "Mana Potion",
    "kind": "icon",
    "glyph": "🍶",
    "color": "#2979ff",
    "image": "/games/magic_potion_clusters/assets/sym_mana_flask.png"
  },
  "CRYSTAL_DUST": {
    "id": "CRYSTAL_DUST",
    "name": "Moon Crystal",
    "kind": "icon",
    "glyph": "🔮",
    "color": "#e040fb",
    "image": "/games/magic_potion_clusters/assets/sym_crystal_dust.png"
  },
  "MAGIC_HERB": {
    "id": "MAGIC_HERB",
    "name": "Alchemic Herb",
    "kind": "icon",
    "glyph": "🌿",
    "color": "#00e676",
    "image": "/games/magic_potion_clusters/assets/sym_magic_herb.png"
  },
  "GLOW_SHROOM": {
    "id": "GLOW_SHROOM",
    "name": "Glow Mushroom",
    "kind": "icon",
    "glyph": "🍄",
    "color": "#ff9100",
    "image": "/games/magic_potion_clusters/assets/sym_glow_shroom.png"
  }
},
  paytable: {
  "ELIXIR": {
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
  "DRAGON_POTION": {
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
  "CAULDRON": {
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
  "MANA_FLASK": {
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
  "CRYSTAL_DUST": {
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
  "MAGIC_HERB": {
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
  "GLOW_SHROOM": {
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
  "ELIXIR": 150,
  "DRAGON_POTION": 220,
  "CAULDRON": 300,
  "MANA_FLASK": 500,
  "CRYSTAL_DUST": 650,
  "MAGIC_HERB": 850,
  "GLOW_SHROOM": 1100,
  "SCATTER": 20
},
  fs_weights: {
  "ELIXIR": 150,
  "DRAGON_POTION": 220,
  "CAULDRON": 300,
  "MANA_FLASK": 500,
  "CRYSTAL_DUST": 650,
  "MAGIC_HERB": 950,
  "GLOW_SHROOM": 1350,
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
