/**
 * Cosmic / Frenzy / Super Win Mode for Social Casino.
 *
 * Transforms spins into epic streamer-style "заносы":
 *   - Screens packed with top-tier premium symbols and WILDs
 *   - WILDs carrying massive x1000 (and x500, x250, x100) multipliers
 *   - Multi-line full-screen connections across all paylines / ways
 *   - Explosive cascades with x1000 multiplier bombs in tumble slots
 *   - Huge clusters with x1024 spots in cluster slots
 */

function isCosmic(game) {
  if (!game) return false;
  return !!(game.cosmic_mode || game.frenzy_mode || (game.rtp_profile && Number(game.rtp_profile) >= 1000));
}

/**
 * Returns top paying symbols sorted by highest payout.
 */
function getTopSymbols(game) {
  const payKeys = Object.keys(game.paytable || {}).filter((s) => s !== 'SCATTER' && s !== 'WILD');
  payKeys.sort((a, b) => {
    const maxA = Math.max(...Object.values(game.paytable[a] || {}));
    const maxB = Math.max(...Object.values(game.paytable[b] || {}));
    return maxB - maxA;
  });
  return payKeys;
}

/**
 * Generates an epic lines grid layout: full connections of top symbols + multiple Wilds with x1000!
 */
function generateCosmicLinesGrid(game, rng, { inFreeSpins = false, forceTrigger = false } = {}) {
  const rows = game.rows_count || 3;
  const cols = game.reels_count || 5;
  const topSyms = getTopSymbols(game);
  const heroSym = topSyms[rng.int(Math.min(3, topSyms.length))] || 'TOP';
  const secondSym = topSyms[(topSyms.indexOf(heroSym) + 1) % topSyms.length] || heroSym;

  // Start with full screen of heroSym
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(heroSym));

  // Distribute 2 to 4 WILDs with x1000 multipliers across reels
  const wildMults = {};
  const maxWilds = Math.min(cols, Math.max(2, Math.floor(cols * 0.7)));
  const wildCount = 2 + rng.int(Math.max(1, maxWilds - 1));

  // Pick distinct columns for wilds
  const colPool = Array.from({ length: cols }, (_, i) => i);
  const chosenCols = [];
  while (chosenCols.length < wildCount && colPool.length) {
    chosenCols.push(colPool.splice(rng.int(colPool.length), 1)[0]);
  }

  const multPool = [1000, 1000, 1000, 500, 250, 100];
  for (const c of chosenCols) {
    const r = rng.int(rows);
    matrix[r][c] = 'WILD';
    wildMults[`${r},${c}`] = multPool[rng.int(multPool.length)];
  }

  // Add occasional second top symbol in non-wild cells for visual richness
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c] !== 'WILD' && rng.int(4) === 0) {
        matrix[r][c] = secondSym;
      }
    }
  }

  // 15% chance to also land 3 SCATTERs to trigger free spins
  if ((forceTrigger || rng.int(7) === 0) && game.free_spins && !inFreeSpins) {
    const triggerCount = game.free_spins.trigger || 3;
    const scatterCols = [0, 2, 4].filter((c) => c < cols);
    while (scatterCols.length < triggerCount && scatterCols.length < cols) {
      const nextC = rng.int(cols);
      if (!scatterCols.includes(nextC)) scatterCols.push(nextC);
    }
    for (const c of scatterCols) {
      const r = (rng.int(rows) + (matrix[0][c] === 'WILD' ? 1 : 0)) % rows;
      matrix[r][c] = 'SCATTER';
      delete wildMults[`${r},${c}`];
    }
  }

  const stops = Array.from({ length: cols }, () => rng.int(100));
  return { matrix, stops, wildMults };
}

/**
 * Generates an epic ways grid layout with multiple Wilds and massive ways hits.
 */
function generateCosmicWaysGrid(game, rng, { inFreeSpins = false, forceTrigger = false } = {}) {
  const rows = game.rows_count || 3;
  const cols = game.reels_count || 5;
  const topSyms = getTopSymbols(game);
  const heroSym = topSyms[rng.int(Math.min(3, topSyms.length))] || 'TOP';
  const secondSym = topSyms[(topSyms.indexOf(heroSym) + 1) % topSyms.length] || heroSym;

  const matrix = Array.from({ length: rows }, () => Array(cols).fill(heroSym));
  const wildMults = {};

  // For ways, placing WILDs on reels 1, 2, 3 multiplies all ways through them
  const wildCols = cols >= 5 ? [1, 2, 3] : [1];
  const multPool = [1000, 1000, 1000, 500, 250, 100];
  for (const c of wildCols) {
    if (rng.int(4) !== 0) { // 75% chance per eligible reel
      const r = rng.int(rows);
      matrix[r][c] = 'WILD';
      wildMults[`${r},${c}`] = multPool[rng.int(multPool.length)];
    }
  }

  // Fill some cells with secondary top symbol
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c] !== 'WILD' && rng.int(3) === 0) {
        matrix[r][c] = secondSym;
      }
    }
  }

  if ((forceTrigger || rng.int(7) === 0) && game.free_spins && !inFreeSpins) {
    const sCols = [0, 2, 4].filter((c) => c < cols);
    for (const c of sCols) {
      const r = (rng.int(rows) + (matrix[0][c] === 'WILD' ? 1 : 0)) % rows;
      matrix[r][c] = 'SCATTER';
      delete wildMults[`${r},${c}`];
    }
  }

  const stops = Array.from({ length: cols }, () => rng.int(100));
  return { matrix, stops, wildMults };
}

/**
 * Enhances a tumble grid for cosmic mode: injects high-paying combinations and M1000 bombs!
 */
function enhanceCosmicTumble(game, grid, rng) {
  const rows = grid.length;
  const cols = grid[0].length;
  const topSyms = getTopSymbols(game);
  const heroSym = topSyms[rng.int(Math.min(3, topSyms.length))] || topSyms[0];
  const secondSym = topSyms[(topSyms.indexOf(heroSym) + 1) % topSyms.length] || heroSym;

  // Guarantee 10-14 matching hero symbols to trigger a huge tumble explosion
  const matchCount = 10 + rng.int(5);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
  // Shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (let i = 0; i < matchCount; i++) {
    const [r, c] = cells[i];
    grid[r][c] = heroSym;
  }

  // Also seed 8 secondSym matches
  for (let i = matchCount; i < Math.min(cells.length, matchCount + 8); i++) {
    const [r, c] = cells[i];
    grid[r][c] = secondSym;
  }

  // Guarantee at least one M1000 multiplier bomb!
  const multPool = ['M1000', 'M500', 'M250'];
  const bombCount = 1 + rng.int(2);
  for (let b = 0; b < bombCount; b++) {
    const [br, bc] = cells[cells.length - 1 - b];
    grid[br][bc] = b === 0 ? 'M1000' : multPool[rng.int(multPool.length)];
  }
}

/**
 * Enhances a cluster grid for cosmic mode: creates huge clusters and charges multiplier spots!
 */
function enhanceCosmicClusters(game, grid, rng, spots = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const topSyms = getTopSymbols(game);
  const heroSym = topSyms[rng.int(Math.min(3, topSyms.length))] || topSyms[0];

  // Create a massive connected block of 10-16 hero symbols
  const startR = rng.int(rows - 3);
  const startC = rng.int(cols - 3);
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 4; dc++) {
      if (startR + dr < rows && startC + dc < cols) {
        grid[startR + dr][startC + dc] = heroSym;
      }
    }
  }

  // Prime several spots with high multipliers (e.g. 256, 512, 1024)
  const spotMultipliers = [256, 512, 1024];
  for (let i = 0; i < 4; i++) {
    const r = rng.int(rows);
    const c = rng.int(cols);
    spots[`${r},${c}`] = spotMultipliers[rng.int(spotMultipliers.length)];
  }
}

module.exports = {
  isCosmic,
  generateCosmicLinesGrid,
  generateCosmicWaysGrid,
  enhanceCosmicTumble,
  enhanceCosmicClusters
};
