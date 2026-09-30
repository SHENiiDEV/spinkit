const { seededRng } = require('./rng');

/**
 * Builds deterministic reel strips from symbol counts.
 *
 * reelCounts: array (one per reel) of { SYMBOL: count }.
 * Special symbols listed in `spaced` are kept at least `minGap` apart
 * (circularly), so e.g. two scatters can never be visible on one reel.
 */
function buildStrips(reelCounts, { seed = 7, spaced = ['SCATTER'], minGap = 3, stacks = {} } = {}) {
  return reelCounts.map((counts, reelIndex) => {
    const rng = seededRng(seed * 131 + reelIndex * 977);
    // Symbols listed in `stacks` are placed in runs (stacked symbols), which
    // makes wins rarer but bigger - the classic "stacked reels" feel.
    const chunks = [];
    for (const [sym, n] of Object.entries(counts)) {
      const size = spaced.includes(sym) ? 1 : (stacks[sym] || stacks['*'] || 1);
      let left = n;
      while (left > 0) {
        const k = Math.min(size, left);
        chunks.push(Array(k).fill(sym));
        left -= k;
      }
    }
    // Fisher–Yates over chunks
    for (let i = chunks.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
    }
    const strip = chunks.flat();
    repairSpacing(strip, spaced, minGap, rng);
    return strip;
  });
}

function circularDist(a, b, len) {
  const d = Math.abs(a - b);
  return Math.min(d, len - d);
}

function isSafe(strip, pos, sym, minGap, ignore = -1) {
  const len = strip.length;
  for (let k = 1; k < minGap; k++) {
    for (const p of [(pos + k) % len, (pos - k + len) % len]) {
      if (p !== ignore && strip[p] === sym) return false;
    }
  }
  return true;
}

function repairSpacing(strip, spaced, minGap, rng) {
  const len = strip.length;
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    for (let i = 0; i < len; i++) {
      const sym = strip[i];
      if (!spaced.includes(sym)) continue;
      if (isSafe(strip, i, sym, minGap, i)) continue;
      // Find a swap target holding a regular symbol where `sym` fits.
      for (let attempt = 0; attempt < len * 2; attempt++) {
        const j = rng.int(len);
        if (spaced.includes(strip[j])) continue;
        const tmp = strip[j];
        strip[j] = sym;
        strip[i] = tmp;
        if (isSafe(strip, j, sym, minGap, j)) {
          changed = true;
          break;
        }
        strip[i] = sym;
        strip[j] = tmp;
      }
    }
    if (!changed) break;
  }
  return strip;
}

module.exports = { buildStrips, circularDist };
