const assert = require('node:assert');
const { KINDS, SKINS } = require('../src/games/skins/ai');
const RAW_GAMES = require('../src/games/definitions');
const { GAMES_CATALOG } = require('../src/games/catalog');

console.log('Testing AI skins registry...');
const ids = new Set();
for (const s of SKINS) {
  assert(!ids.has(s.id), `duplicate id ${s.id}`);
  assert(!RAW_GAMES.some((g) => g.id === s.id), `${s.id} clashes with a template`);
  ids.add(s.id);
  const kind = KINDS[s.kind];
  assert(kind, `${s.id}: unknown kind ${s.kind}`);
  const tpl = RAW_GAMES.find((g) => g.id === kind.template);
  assert(tpl, `${s.id}: template ${kind.template} missing`);
  for (const id of Object.keys(s.sym)) assert(tpl.symbols[id], `${s.id}: template has no symbol ${id}`);
  for (const sh of kind.sheets) for (const id of sh.ids) if (!id.startsWith('_')) assert(tpl.symbols[id], `${kind.template}: sheet symbol ${id}`);
  assert(/^#[0-9a-f]{6}$/i.test(s.look.accent) && s.scene && s.name, `${s.id}: look/scene/name`);
}
const perKind = {};
SKINS.forEach((s) => { perKind[s.kind] = (perKind[s.kind] || 0) + 1; });
assert.deepStrictEqual(perKind, { megaways: 10, clusters: 10, holdwin: 10, matchlines: 10, titans: 10 });
// a skin shows up only after its artwork is imported
for (const s of SKINS) {
  const g = GAMES_CATALOG[s.id];
  if (!g) continue;
  assert.strictEqual(g.rtp, GAMES_CATALOG[KINDS[s.kind].template].rtp, `${s.id}: same RTP as its template`);
}
console.log('✔ 50 AI skins: unique ids, valid templates and symbols');

// ------------------------------------------------------------------ collections (admin grouping)
{
  const { collectionOf, COLLECTIONS } = require('../src/games/catalog');
  const all = Object.values(GAMES_CATALOG);
  for (const g of all) assert(COLLECTIONS[collectionOf(g)], `${g.id}: collection`);
  assert.strictEqual(collectionOf(GAMES_CATALOG.tiki_titans), 'artwork');
  assert.strictEqual(collectionOf(GAMES_CATALOG.pharaoh_riches), 'basic');
  assert(all.some((g) => collectionOf(g) === 'artwork') && all.some((g) => collectionOf(g) === 'basic'));
}
console.log('✔ collections: every game is "artwork" or "basic"');
