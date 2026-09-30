#!/usr/bin/env node
/**
 * Golden master for refactors: plays every game with a fixed seed (base spins, bought features
 * and whole free-spins rounds) and fingerprints the results, the built game definitions and the
 * public game config. Math or contract changes show up as a different fingerprint.
 *
 *   node scripts/golden-master.js --write [file]   # record (default: /tmp/spinkit-golden.json)
 *   node scripts/golden-master.js --check [file]   # compare with a recording
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.SPINKIT_DB = process.env.SPINKIT_DB || path.join(os.tmpdir(), `spinkit-golden-${process.pid}.db`);
process.env.SPINKIT_QUIET = '1';

const { GAMES_CATALOG } = require('../src/games/catalog');
const { RgsEngine } = require('../src/engine/rgs');
const { seededRng } = require('../src/engine/rng');
const { publicGameConfig } = require('../src/services/game-service');

const args = process.argv.slice(2);
const mode = args.includes('--write') ? 'write' : 'check';
const file = args.find((a) => !a.startsWith('--')) || path.join(os.tmpdir(), 'spinkit-golden.json');
const SPINS = Number(process.env.GOLDEN_SPINS || 150);

// canonical JSON: key order does not matter, values do
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const hash = (v) => crypto.createHash('sha1').update(JSON.stringify(canon(v))).digest('hex').slice(0, 16);
const clean = (r) => { const { round_id: _, ...rest } = r; return rest; };

function playGame(game) {
  const rng = seededRng(12345);
  const out = [];
  for (let i = 0; i < SPINS; i++) out.push(clean(RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng })));
  if (game.free_spins && game.free_spins.buy) {
    for (let k = 0; k < 2; k++) {
      const base = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, buyFeature: true });
      out.push(clean(base));
      const state = { free_spins_left: base.free_spins.remaining, free_spins_bet: base.bet, free_spins_total_win: 0, active_bonus_data: base.bonus };
      for (let n = 0; n < 200 && state.free_spins_left > 0; n++) {
        const r = RgsEngine.calculateSpin({ game, betAmount: game.default_bet, rng, activeState: state });
        out.push(clean(r));
        state.free_spins_left = r.free_spins.remaining;
        state.free_spins_total_win += r.total_win;
        state.active_bonus_data = r.bonus;
      }
    }
  }
  return out;
}

// Merchant API game details (/api/v2/games/:id) through a fake router, demo merchant.
const handlers = {};
const fakeRouter = { get: (p, ...fns) => { handlers[`GET ${p}`] = fns[fns.length - 1]; }, post: () => {}, put: () => {}, patch: () => {}, delete: () => {} };
require('../src/http/merchant-api').register(fakeRouter);
const { dbService } = require('../src/db/database');
const demo = dbService.db.prepare('SELECT * FROM merchants ORDER BY created_at LIMIT 1').get();
function merchantDetails(id) {
  try {
    return handlers['GET /api/v2/games/:game_id']({ merchant: demo, params: { game_id: id }, query: {}, baseUrl: 'http://x' });
  } catch (e) {
    return { error: e.message };
  }
}

const snapshot = {};
for (const game of Object.values(GAMES_CATALOG)) {
  snapshot[game.id] = {
    definition: hash(game),
    public_config: hash(publicGameConfig(game)),
    merchant_api: hash(merchantDetails(game.id)),
    spins: hash(playGame(game))
  };
}

if (mode === 'write') {
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));
  console.log(`golden master written: ${Object.keys(snapshot).length} games -> ${file}`);
} else {
  const ref = JSON.parse(fs.readFileSync(file, 'utf8'));
  let bad = 0;
  for (const id of new Set([...Object.keys(ref), ...Object.keys(snapshot)])) {
    const a = ref[id];
    const b = snapshot[id];
    if (!a || !b) { console.log(`✗ ${id}: ${a ? 'missing now' : 'new game'}`); bad++; continue; }
    const diff = Object.keys(a).filter((k) => a[k] !== b[k]);
    if (diff.length) { console.log(`✗ ${id}: ${diff.join(', ')} changed`); bad++; }
  }
  console.log(bad ? `${bad} game(s) differ` : `✔ all ${Object.keys(snapshot).length} games identical`);
  process.exitCode = bad ? 1 : 0;
}
try { fs.unlinkSync(process.env.SPINKIT_DB); } catch { /* ignore */ }
