/**
 * Reel-strip helpers for the mechanics that spin real strips (lines, ways, hold & win).
 */

function readWindow(strips, stops, rows) {
  const cols = strips.length;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(''));
  for (let c = 0; c < cols; c++) {
    const strip = strips[c];
    for (let r = 0; r < rows; r++) {
      matrix[r][c] = strip[(stops[c] + r) % strip.length];
    }
  }
  return matrix;
}

/**
 * Spins the reels. When `forceScatters` is set (feature buy), the stops are
 * chosen so that at least that many reels show a SCATTER in the window.
 */
function spinReels(strips, rows, rng, { forceScatters = 0, customStops = null } = {}) {
  const cols = strips.length;
  const stops = [];
  for (let c = 0; c < cols; c++) {
    const len = strips[c].length;
    stops.push(customStops && customStops[c] !== undefined ? ((customStops[c] % len) + len) % len : rng.int(len));
  }

  if (forceScatters > 0 && !customStops) {
    const scatterReels = [];
    for (let c = 0; c < cols; c++) if (strips[c].includes('SCATTER')) scatterReels.push(c);
    // pick `forceScatters` distinct reels
    const chosen = [];
    const pool = scatterReels.slice();
    while (chosen.length < forceScatters && pool.length) {
      chosen.push(pool.splice(rng.int(pool.length), 1)[0]);
    }
    for (const c of chosen) {
      const strip = strips[c];
      const idx = [];
      strip.forEach((s, i) => { if (s === 'SCATTER') idx.push(i); });
      const scatterAt = idx[rng.int(idx.length)];
      const offset = rng.int(rows); // which row the scatter lands on
      stops[c] = (scatterAt - offset + strip.length) % strip.length;
    }
  }

  return { matrix: readWindow(strips, stops, rows), stops };
}

/** Strip set for the current spin: free-spins strips when the game has them. */
function stripsFor(game, inFreeSpins) {
  return inFreeSpins && game.fs_reel_strips ? game.fs_reel_strips : game.reel_strips;
}

module.exports = { readWindow, spinReels, stripsFor };
