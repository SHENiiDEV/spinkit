/**
 * Skins: new games that reuse a template's math 1:1 (reels, paytable, calibration) with a new
 * theme, symbols and art. Two families:
 *   applySkin       classic templates (lines / ways / tumble) — data in skins/classic.js
 *   applyGiantSkin  the giants template (Enchanted Knight)   — data in skins/giants.js
 */
const { icon, wild, scatter } = require('./kit');

// Symbol roles of each template, highest pay first. A skin replaces these
// symbols 1:1, so reels, paytable and RTP stay exactly the template's.
const TEMPLATE_ROLES = {
  pharaoh_riches: { h: ['FALCON', 'COBRA', 'SCARAB', 'JAR'], l: ['A', 'K', 'Q', 'J', '10'] },
  vegas_fruits: { h: ['BAR', 'BELL', 'MELON', 'GRAPES'], l: ['PLUM', 'ORANGE', 'LEMON', 'CHERRY'] },
  cyber_neon: { h: ['ANDROID', 'ALIEN', 'CHIP', 'BOLT'], l: ['A', 'K', 'Q', 'J'] },
  olympus_thunder: { h: ['CROWN', 'HOURGLASS', 'RING', 'CHALICE'], l: ['RED', 'PURPLE', 'YELLOW', 'GREEN', 'BLUE'] },
  sweet_sugar: { h: ['HEART', 'PURPLE', 'GREEN', 'BLUE'], l: ['APPLE', 'PLUM', 'MELON', 'GRAPE', 'BANANA'] },
  jade_dragon: { h: ['TIGER', 'KOI', 'COIN', 'FAN'], l: ['A', 'K', 'Q', 'J', '10'] },
  wild_safari: { h: ['RHINO', 'ELEPHANT', 'ZEBRA', 'GIRAFFE'], l: ['A', 'K', 'Q', 'J', '10'] },
  enchanted_knight: { h: ['PRINCESS', 'SWAN', 'RING_BOX', 'DAGGER'], l: ['LOVE_LETTER', 'HEART_GEM', 'DIAMOND_GEM', 'STAR_GEM', 'MOON_GEM'] }
};

function mixHex(hex, target, t) {
  const n = (h) => parseInt(h.replace('#', ''), 16);
  const a = n(hex);
  const b = n(target);
  const ch = (v, sh) => (v >> sh) & 255;
  const out = [16, 8, 0].map((sh) => Math.round(ch(a, sh) + (ch(b, sh) - ch(a, sh)) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function renameKeys(obj, map) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] || k] = v;
  return out;
}

function symbolFromSpec(id, [name, glyph, color, extra = {}]) {
  if (glyph === 'BAR') return { id, name, kind: 'bar', label: 'BAR', color };
  if (!glyph) return { id, name, kind: 'icon', glyph: null, color, ...extra };
  return icon(id, name, glyph, color, extra);
}

function applySkin(tpl, sk) {
  const roles = TEMPLATE_ROLES[tpl.id];
  const raw = JSON.parse(JSON.stringify(tpl));
  const used = new Set(['WILD', 'SCATTER', 'MULT', 'A', 'K', 'Q', 'J', '10']);
  const map = {};
  const symbols = {};
  const slug = (name) => {
    let base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 14) || 'SYM';
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
    used.add(id);
    return id;
  };

  if (tpl.symbols.WILD && sk.w) {
    const [name, glyph, color] = sk.w;
    symbols.WILD = glyph === '7'
      ? { id: 'WILD', name, kind: 'seven', label: '7', color, isWild: true }
      : wild(name, glyph, color);
  } else if (tpl.symbols.WILD) {
    symbols.WILD = tpl.symbols.WILD;
  }
  if (tpl.symbols.MULT) symbols.MULT = { ...tpl.symbols.MULT, glyph: sk.m || tpl.symbols.MULT.glyph };
  symbols.SCATTER = sk.s ? scatter(sk.s[0], sk.s[1], sk.s[2]) : tpl.symbols.SCATTER;

  const assign = (oldIds, specs) => {
    oldIds.forEach((oldId, i) => {
      const spec = specs && specs[i];
      if (!spec) {
        symbols[oldId] = { ...tpl.symbols[oldId] };
        return;
      }
      const id = slug(spec[0]);
      map[oldId] = id;
      symbols[id] = symbolFromSpec(id, spec);
    });
  };
  assign(roles.h, sk.h);
  assign(roles.l, sk.l);

  // Recolour / reshape procedural gems and royal letters
  if (sk.gems) roles.l.forEach((id, i) => { if (sk.gems[i] && symbols[id]) Object.assign(symbols[id], { color: sk.gems[i][0], shape: sk.gems[i][1] }); });
  if (sk.rc) roles.l.forEach((id, i) => { if (sk.rc[i] && symbols[id] && symbols[id].kind === 'royal') symbols[id].color = sk.rc[i]; });

  raw.id = sk.id;
  raw.name = sk.name;
  raw.category = sk.cat;
  raw.skin_of = tpl.id;
  raw.calibration_from = tpl.id;
  raw.symbols = symbols;
  raw.paytable = renameKeys(tpl.paytable, map);
  if (tpl.reels) raw.reels = tpl.reels.map((r) => renameKeys(r, map));
  if (tpl.fs_reels) raw.fs_reels = tpl.fs_reels.map((r) => renameKeys(r, map));
  if (tpl.weights) raw.weights = renameKeys(tpl.weights, map);
  if (tpl.fs_weights) raw.fs_weights = renameKeys(tpl.fs_weights, map);
  if (tpl.stacks) raw.stacks = renameKeys(tpl.stacks, map);
  if (tpl.giants) raw.giants = renameKeys(tpl.giants, map);

  const L = sk.look;
  const words = sk.name.toUpperCase().split(' ');
  const title = L.t || (words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : ['', words[0]]);
  const brightBg = parseInt(L.b1.slice(1, 3), 16) + parseInt(L.b1.slice(3, 5), 16) + parseInt(L.b1.slice(5, 7), 16) > 380;
  raw.theme = {
    accent: L.a,
    bg1: L.b1,
    bg2: L.b2,
    frame: L.rim || 'gold',
    particles: L.p || 'dust',
    scene: L.sc || 'sunburst',
    font: L.f || 'Cinzel',
    title,
    icon: (sk.w && sk.w[1] !== '7' ? sk.w[1] : null) || (sk.s && sk.s[1]) || tpl.theme.icon,
    medallions: !!L.med,
    lightReels: !!L.light,
    reelBg: L.light
      ? ['#fff8ec', '#f1dfc0']
      : brightBg
        ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.12)']
        : [mixHex(L.b1, '#000000', 0.45), mixHex(L.b2, '#000000', 0.2)]
  };
  return raw;
}

// Same math as Enchanted Knight (reels, paytable, sticky multipliers, calibration); new theme & art.
const GIANT_ROLES = { h: ['SWAN', 'RING_BOX', 'DAGGER', 'LOVE_LETTER'], gems: ['HEART_GEM', 'DIAMOND_GEM', 'STAR_GEM', 'MOON_GEM'] };
const GEM_NAMES = { heart: 'Heart Gem', hex: 'Hex Gem', diamond: 'Diamond Gem', octagon: 'Octagon Gem', oval: 'Oval Gem', triangle: 'Trillion Gem', square: 'Square Gem' };

function applyGiantSkin(tpl, sk) {
  const raw = JSON.parse(JSON.stringify(tpl));
  const A = `/games/${sk.id}/assets`;
  const used = new Set(['WILD', 'SCATTER']);
  const slug = (name) => {
    const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 14) || 'SYM';
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
    used.add(id);
    return id;
  };
  const map = {};
  const symbols = {};
  const img = (file) => (file ? { image: `${A}/${file}`, plain: true } : {});
  const badge = sk.custom_art ? {} : { badge_y: 0.73 }; // generated portraits have a medallion there
  const giantId = slug(sk.giant[0]);
  map.PRINCESS = giantId;
  symbols.WILD = wild(sk.wild[0], sk.wild[1], sk.wild[2], { giant: true, plain: true, ...badge, image: `${A}/wild.png`, tall_image: `${A}/wild.png` });
  const I = sk.images || {};
  symbols.SCATTER = scatter(sk.scatter[0], sk.scatter[1], sk.scatter[2], img(I.scatter));
  symbols[giantId] = icon(giantId, sk.giant[0], sk.giant[1], sk.giant[2], { giant: true, plain: true, ...badge, image: `${A}/giant.png`, tall_image: `${A}/giant.png` });
  GIANT_ROLES.h.forEach((old, i) => {
    const [name, glyph, color] = sk.h[i];
    const id = slug(name);
    map[old] = id;
    symbols[id] = icon(id, name, glyph, color, img(I.h && I.h[i]));
  });
  GIANT_ROLES.gems.forEach((old, i) => {
    const [color, shape] = sk.gems[i];
    const name = GEM_NAMES[shape] || 'Gem';
    const id = slug(name);
    map[old] = id;
    symbols[id] = icon(id, name, null, color, { gem: true, shape, ...img(I.gems && I.gems[i]) });
  });

  raw.id = sk.id;
  raw.name = sk.name;
  raw.category = sk.cat;
  raw.skin_of = tpl.id;
  raw.calibration_from = tpl.id;
  raw.symbols = symbols;
  raw.paytable = renameKeys(tpl.paytable, map);
  raw.reels = tpl.reels.map((r) => renameKeys(r, map));
  raw.fs_reels = tpl.fs_reels.map((r) => renameKeys(r, map));
  raw.giants = renameKeys(tpl.giants, map);
  const sm = tpl.free_spins.sticky_multipliers;
  if (sm && !Object.keys(sm).every((k) => /^\d+$/.test(k))) raw.free_spins.sticky_multipliers = renameKeys(sm, map);
  const L = sk.look;
  raw.theme = {
    accent: L.accent,
    bg1: L.bg1,
    bg2: L.bg2,
    frame: 'none',
    particles: L.particles || 'sparkle',
    font: L.font || 'Cinzel',
    icon: sk.wild[1],
    title: L.title,
    reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    cover: `${A}/cover.jpg`,
    stage: { ...tpl.theme.stage, ...(sk.stage || {}), image: `${A}/stage.jpg` },
    symbolScale: (sk.stage && sk.stage.symbol_scale) || 0.92
  };
  return raw;
}

module.exports = { applySkin, applyGiantSkin, TEMPLATE_ROLES };
