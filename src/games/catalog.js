/**
 * The game catalog: every template in definitions/ plus every skin, built and ready to play.
 *
 *   GAMES_CATALOG   { id: game }   in lobby order (templates, classic skins, giant skins)
 *   getGame(id, rtpProfile)        the game in another RTP version (operator profiles / QA)
 */
const { buildGame, toIconFile, CALIBRATION } = require('./build');
const { applySkin, applyGiantSkin } = require('./skinning');
const { SKINS } = require('./skins/classic');
const { GIANT_SKINS } = require('./skins/giants');

const RAW_GAMES = require('./definitions');

const GAMES_CATALOG = {};
function add(raw) {
  if (GAMES_CATALOG[raw.id]) throw new Error(`Duplicate game id ${raw.id}`);
  GAMES_CATALOG[raw.id] = buildGame(raw);
}
const template = (id) => {
  const tpl = RAW_GAMES.find((g) => g.id === id);
  if (!tpl) throw new Error(`Unknown template ${id}`);
  return tpl;
};

RAW_GAMES.forEach(add);
SKINS.forEach((sk) => add(applySkin(template(sk.base), sk)));
GIANT_SKINS.forEach((sk) => add(applyGiantSkin(template(sk.base || 'enchanted_knight'), sk)));
// AI-art skins (src/games/skins/ai.js): only those whose artwork has been imported
require('./ai-skins').build(RAW_GAMES).forEach(add);

// lobby thumbnails (scripts/gen-thumbs.js → scripts/import-thumbs.py): public/games/<id>/assets/thumb.jpg
for (const g of Object.values(GAMES_CATALOG)) {
  const url = `/games/${g.id}/assets/thumb.jpg`;
  if (require('node:fs').existsSync(require('node:path').join(__dirname, '../../public', url))) g.theme = { ...g.theme, thumb: url };
}

// ---------------------------------------------------------------- RTP profiles
/**
 * Operator-selectable RTP versions (like the 94 / 96% versions big providers ship).
 * A profile rescales every pay of the certified paytable by target / certified RTP,
 * which scales RTP linearly (reels, features and hit rate stay identical).
 * 96 = the certified base version (no scaling).
 */
const RTP_PROFILES = [88, 90, 92, 94, 96];
const QA_RTP_RANGE = [10, 300]; // test sessions only (flagged test players)
const profileCache = new Map();

function baseRtp(game) {
  return parseFloat(game.rtp) || 96;
}

/**
 * Returns the game in the requested RTP profile.
 *   profile: null/96 -> certified version; one of RTP_PROFILES; or (qa=true) any value in QA_RTP_RANGE.
 */
function getGame(id, profile = null, { qa = false } = {}) {
  const base = GAMES_CATALOG[id];
  if (!base) return null;
  const target = profile == null ? 96 : Number(profile);
  if (!target || target === 96) return base;
  const allowed = qa ? target >= QA_RTP_RANGE[0] && target <= QA_RTP_RANGE[1] : RTP_PROFILES.includes(target);
  if (!allowed) throw new Error(`RTP profile ${profile} is not allowed`);
  const key = `${id}@${target}`;
  if (!profileCache.has(key)) {
    const g = buildGame(base._raw, { scaleMult: target / baseRtp(base) });
    g.rtp = `${target.toFixed(2)}%`;
    g.rtp_profile = target;
    g.certified_rtp = base.rtp;
    profileCache.set(key, g);
  }
  return profileCache.get(key);
}

// ---------------------------------------------------------------- collections
/**
 * Art collection of a game (admin / lobby grouping):
 *   'artwork' — painted cabinet + symbol art (theme.stage)
 *   'basic'   — procedural reels with emoji / drawn symbols (no cabinet art yet)
 */
const COLLECTIONS = {
  artwork: { id: 'artwork', name: 'With artwork', hint: 'Painted cabinet and symbols' },
  basic: { id: 'basic', name: 'Basic (no artwork)', hint: 'Procedural reels with emoji symbols' }
};
const collectionOf = (g) => (g.theme && g.theme.stage ? 'artwork' : 'basic');

module.exports = { COLLECTIONS, collectionOf, GAMES_CATALOG, RAW_GAMES, CALIBRATION, RTP_PROFILES, QA_RTP_RANGE, buildGame, getGame, toIconFile, applySkin, applyGiantSkin };
