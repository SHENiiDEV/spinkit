/**
 * Builds the AI-art skins (src/games/skins/ai.js) whose artwork has been imported
 * (public/games/<id>/assets/stage.json, written by scripts/import-ai-art.py).
 * Each one is reskin(template): the template's math 1:1, new name, theme, symbol names and pictures.
 */
const fs = require('node:fs');
const path = require('node:path');
const { KINDS, SKINS, assetName } = require('./skins/ai');
const { reskin } = require('./kit');

const PUBLIC = path.join(__dirname, '../../public');

const TAGLINES = {
  megaways: 'Up to 117,649 ways · Cascades · Win multiplier grows every cascade',
  clusters: 'Cluster pays · Tumbles · Multiplier spots up to x1024',
  holdwin: '20 lines · Hold & Win respins · Collector & Booster coins · 4 jackpots',
  matchlines: 'Line cascades · Multiplier up to x1024 · Even multipliers in Free Spins',
  titans: '9,600 ways · Full-reel sticky Wilds x5–x5000 · Giant symbols'
};

const exists = (url) => fs.existsSync(path.join(PUBLIC, url));

function title(name) {
  const words = name.toUpperCase().split(' ');
  if (words.length === 1) return [words[0], ''];
  const cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

function build(rawGames) {
  const out = [];
  for (const s of SKINS) {
    const dir = `/games/${s.id}/assets`;
    if (!exists(`${dir}/stage.json`)) continue; // artwork not generated / imported yet
    const kind = KINDS[s.kind];
    const tpl = rawGames.find((g) => g.id === kind.template);
    if (!tpl) throw new Error(`AI skin ${s.id}: unknown template ${kind.template}`);
    const stage = JSON.parse(fs.readFileSync(path.join(PUBLIC, dir, 'stage.json'), 'utf8'));
    const symbols = {};
    for (const [id, name] of Object.entries(s.sym)) symbols[id] = { name };
    const raw = reskin(tpl, {
      id: s.id,
      name: s.name,
      category: s.category,
      tagline: TAGLINES[s.kind],
      theme: {
        ...s.look,
        title: title(s.name),
        frame: 'none',
        reelBg: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
        plainSymbols: true,
        symbolScale: 0.92,
        cover: `${dir}/cover.jpg`,
        stage
      },
      symbols
    });
    delete raw.theme.logo;
    delete raw.theme.background;
    // every symbol cut from the sheets gets its picture
    for (const sheet of kind.sheets) {
      for (const id of sheet.ids) {
        if (!raw.symbols[id]) continue;
        raw.symbols[id].image = `${dir}/${assetName(s.kind, id)}`;
        raw.symbols[id].plain = true;
      }
    }
    // drop references to pictures / videos this skin does not have (e.g. the template's animated giant)
    for (const sym of Object.values(raw.symbols)) {
      for (const k of ['image', 'tall_image', 'tall_mask']) if (sym[k] && !exists(sym[k])) delete sym[k];
      if (sym.tall_video && ![].concat(sym.tall_video).every(exists)) { delete sym.tall_video; delete sym.tall_mask; }
    }
    if (raw.holdwin && s.jackpots) raw.holdwin = { ...raw.holdwin, jackpot_names: s.jackpots };
    out.push(raw);
  }
  return out;
}

module.exports = { build };
