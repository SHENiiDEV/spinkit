#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const GAMES = {
  valhalla_giants: {
    cab: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/valhalla_cabinet_1790348165230.jpg',
    chars: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/valhalla_characters_1790348197753.jpg',
    symbols: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/valhalla_symbols_1790348182950.jpg',
    cropHPercent: 1.0, // whole cell
    stage: { width: 1200, height: 896, reels: { x: 218, y: 268, w: 764, h: 508 }, pad: 6, symbol_scale: 1 }
  },
  pirate_queen_giants: {
    cab: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/pirate_queen_cabinet_1790348254046.jpg',
    chars: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/pirate_queen_characters_1790348284744.jpg',
    symbols: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/pirate_queen_symbols_1790348269127.jpg',
    cropHPercent: 1.0,
    stage: { width: 1200, height: 896, reels: { x: 260, y: 260, w: 680, h: 495 }, pad: 6, symbol_scale: 1 }
  },
  olympus_titans: {
    cab: '/Users/mihailssegins/.gemini/antigravity/brain/36b90d4b-9d34-4bbe-8b07-ca9dee606638/.user_uploaded/media_1790440600284.jpg',
    chars: '/Users/mihailssegins/.gemini/antigravity/brain/36b90d4b-9d34-4bbe-8b07-ca9dee606638/.user_uploaded/media_1790440666173.jpg',
    symbols: '/Users/mihailssegins/.gemini/antigravity/brain/36b90d4b-9d34-4bbe-8b07-ca9dee606638/.user_uploaded/media_1790440602697.jpg',
    cropHPercent: 1.0,
    stage: { width: 1024, height: 917, reels: { x: 213, y: 297, w: 597, h: 415 }, pad: 6, symbol_scale: 1 }
  },
  sakura_blade_giants: {
    cab: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/sakura_cabinet_1790348349927.jpg',
    chars: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/sakura_characters_1790348384594.jpg',
    symbols: '/Users/mihailssegins/.gemini/antigravity/brain/17ffa57c-a23b-41c4-8c99-05db9136c55d/sakura_symbols_1790348366154.jpg',
    cropHPercent: 0.80, // exclude text label below
    stage: { width: 1200, height: 896, reels: { x: 300, y: 300, w: 600, h: 415 }, pad: 6, symbol_scale: 1 }
  }
};

const SYM_NAMES = [
  'sym_scatter.png', 'sym_h1.png', 'sym_h2.png',
  'sym_h3.png',      'sym_h4.png', 'sym_gem1.png',
  'sym_gem2.png',    'sym_gem3.png', 'sym_gem4.png'
];

function processGame(gameId, cfg) {
  const outDir = path.join(__dirname, '..', 'public', 'games', gameId, 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Processing ${gameId} -> ${outDir}`);

  // 1. Stage and Cover
  if (cfg.cab && fs.existsSync(cfg.cab)) {
    fs.copyFileSync(cfg.cab, path.join(outDir, 'stage.jpg'));
    fs.copyFileSync(cfg.cab, path.join(outDir, 'cover.jpg'));
    console.log('  ✓ stage.jpg and cover.jpg copied');
  }

  // 2. Characters (Giant & Wild)
  if (cfg.chars && fs.existsSync(cfg.chars)) {
    const dim = execSync(`sips -g pixelWidth -g pixelHeight "${cfg.chars}"`).toString();
    const cW = parseInt(dim.match(/pixelWidth: (\d+)/)[1]) || 1024;
    if (cW < 600) {
      // 409x1024 layout
      execSync(`magick "${cfg.chars}" -crop 190x1000+8+6 +repage -resize 400x1060\\! "${path.join(outDir, 'giant.png')}"`);
      execSync(`magick "${cfg.chars}" -crop 191x1000+210+7 +repage -resize 400x1060\\! "${path.join(outDir, 'wild.png')}"`);
    } else {
      // 1024x1024 side by side cards
      execSync(`magick "${cfg.chars}" -crop 450x885+35+65 +repage -resize 400x1060\\! "${path.join(outDir, 'giant.png')}"`);
      execSync(`magick "${cfg.chars}" -crop 450x885+515+65 +repage -resize 400x1060\\! "${path.join(outDir, 'wild.png')}"`);
    }
    console.log('  ✓ giant.png and wild.png sliced');
  }

  // 3. 9 Symbols from 3x3 sheet
  if (cfg.symbols && fs.existsSync(cfg.symbols)) {
    const dim = execSync(`sips -g pixelWidth -g pixelHeight "${cfg.symbols}"`).toString();
    const sheetW = parseInt(dim.match(/pixelWidth: (\d+)/)[1]) || 1024;
    const sheetH = parseInt(dim.match(/pixelHeight: (\d+)/)[1]) || 1024;
    const cellW = Math.round(sheetW / 3);
    const cellH = Math.round(sheetH / 3);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const name = SYM_NAMES[idx];
        const x = Math.round(col * cellW);
        const y = Math.round(row * cellH);
        const cropH = Math.round(cellH * (cfg.cropHPercent || 1.0));
        const dest = path.join(outDir, name);

        execSync(`magick "${cfg.symbols}" -crop ${cellW}x${cropH}+${x}+${y} +repage -fuzz 12% -transparent white -trim +repage -resize 280x280 -gravity center -background none -extent 320x320 "${dest}"`);
      }
    }
    console.log('  ✓ 9 symbols extracted with transparent backgrounds');
  }
}

const target = process.argv[2];
if (target && GAMES[target]) {
  processGame(target, GAMES[target]);
} else {
  for (const [id, cfg] of Object.entries(GAMES)) {
    processGame(id, cfg);
  }
}
console.log('Done!');
