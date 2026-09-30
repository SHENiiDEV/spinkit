const crypto = require('node:crypto');

/**
 * RNG helpers. Production spins use node:crypto (CSPRNG).
 * A seeded PRNG is available only for deterministic reel-strip building,
 * tests and simulations.
 */

function cryptoRng() {
  return {
    int: (maxExclusive) => crypto.randomInt(0, maxExclusive),
    float: () => crypto.randomInt(0, 2 ** 30) / 2 ** 30
  };
}

function seededRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    float: next
  };
}

/** Fast non-crypto RNG for large simulations. */
function fastRng() {
  return seededRng((Math.random() * 2 ** 31) | 0);
}

/**
 * Builds a weighted picker. weights: { SYMBOL: weight }.
 */
function weightedTable(weights) {
  let entries = Object.entries(weights).filter(([, w]) => w > 0);
  // crypto RNG needs an integer range: fractional weights (e.g. 9.5) are scaled to integers
  if (entries.some(([, w]) => !Number.isInteger(w))) entries = entries.map(([k, w]) => [k, Math.round(w * 1000)]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return {
    total,
    pick(rng) {
      let roll = rng.int(total);
      for (const [key, w] of entries) {
        if (roll < w) return key;
        roll -= w;
      }
      return entries[entries.length - 1][0];
    }
  };
}

module.exports = { cryptoRng, seededRng, fastRng, weightedTable };
