#!/usr/bin/env node
/**
 * Paints lobby thumbnails (hero character + big 3D game logo) for the games WITH artwork,
 * using the OpenAI Images API. The game's own pictures (hero symbol, Wild, cabinet) are sent as
 * references, so the thumbnail matches the art inside the game.
 *
 *   node scripts/gen-thumbs.js --list                 # artwork games and whether they have a thumbnail
 *   node scripts/gen-thumbs.js tiki_titans            # one or more games
 *   node scripts/gen-thumbs.js --all                  # every artwork game without a thumbnail yet
 *   add --dry to print the prompts, --force to repaint, --no-ref to paint from text only
 *
 * Needs OPENAI_API_KEY (SpinKit/.env). Optional: OPENAI_IMAGE_MODEL (default gpt-image-1),
 * OPENAI_THUMB_QUALITY (default high), OPENAI_CONCURRENCY (default 3).
 *
 * Output: art-src/thumbs/<id>.png (1536x1024). Then `python3 scripts/import-thumbs.py --all`
 * crops them to 4:3 → public/games/<id>/assets/thumb.jpg; the lobby shows them after a restart.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'art-src', 'thumbs');
const PUBLIC = path.join(ROOT, 'public');

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// scenes of the hand-made artwork games (AI skins bring their own `scene`)
const SCENES = {
  enchanted_knight: 'a fairy-tale castle garden at golden sunset with roses, butterflies and a sparkling lake',
  sweet_spot_mania: 'a candy wonderland with pastel pink skies, lollipop trees, cupcake hills and flying sprinkles',
  jaguar_temple_megaways: 'an overgrown Aztec step pyramid deep in a steaming jungle with golden sun rays',
  wolf_moon_holdwin: 'snowy pine mountains under a giant glowing full moon, northern lights in the sky',
  gold_rush_canyon: 'a wild-west red rock canyon with a gold mine, mine cart rails and a blazing sunset',
  tiki_titans: 'a tropical volcanic island with tiki totems, turquoise lagoon and an erupting volcano',
  cleopatra_giants: 'an ancient Egyptian palace on the Nile with pyramids, palm trees and golden light',
  valhalla_giants: 'Norse mountains and a longship fjord under stormy skies with lightning and aurora',
  pirate_queen_giants: 'a pirate ship deck on a stormy sea at sunset with treasure chests and gold coins',
  olympus_titans: 'marble temples of Mount Olympus above the clouds with lightning and golden light',
  sakura_blade_giants: 'a Japanese temple garden with cherry blossoms, a red pagoda and a moonlit sky',
  blood_moon_giants: 'a gothic vampire castle on a cliff under a huge blood-red moon with bats',
  sheriff_showdown_giants: 'a dusty wild-west main street at high noon with a saloon and cacti',
  poseidon_pearls_giants: 'an underwater palace of coral and pearls with sun rays through blue water',
  star_pilots_giants: 'a neon sci-fi space station hangar with planets, nebulae and starships'
};

const LOW = /^(A|K|Q|J|10|9)$/;
const MINOR = /gem|coin|ruby|jade|topaz|sapphire|diamond/i;

function artworkGames() {
  const { GAMES_CATALOG, collectionOf } = require('../src/games/catalog');
  const { SKINS } = require('../src/games/skins/ai');
  return Object.values(GAMES_CATALOG).filter((g) => collectionOf(g) === 'artwork').map((g) => {
    const skin = SKINS.find((s) => s.id === g.id);
    const syms = Object.entries(g.symbols);
    const hero = syms.find(([id, s]) => !LOW.test(id) && !s.isWild && !s.isScatter && id !== 'WILD' && id !== 'SCATTER' && !MINOR.test(s.name) && s.image)
      || syms.find(([id, s]) => !LOW.test(id) && !s.isScatter && s.image);
    const wild = syms.find(([id, s]) => (id === 'WILD' || s.isWild) && s.image);
    return {
      id: g.id,
      name: g.name,
      scene: (skin && skin.scene) || SCENES[g.id] || `the world of ${g.name}`,
      accent: g.theme.accent,
      hero: hero ? { name: hero[1].name, image: hero[1].tall_image || hero[1].image } : null,
      wild: wild ? { name: wild[1].name.replace(/\s*Wild$/i, ''), image: wild[1].image } : null,
      stage: g.theme.stage ? g.theme.stage.image : g.theme.cover
    };
  });
}

function logoText(name) {
  const m = /^(.*?)\s+(Megaways|Hold & Win)$/i.exec(name);
  return m ? `"${m[1].toUpperCase()}" with a smaller second line "${m[2].toUpperCase()}"` : `"${name.toUpperCase()}"`;
}

function prompt(g, withRef) {
  const cast = [g.hero && `${g.hero.name} as the big hero in the foreground`, g.wild && g.hero && g.wild.name !== g.hero.name && `the ${g.wild.name} as a secondary element beside it`].filter(Boolean).join(', ');
  return [
    'Premium promotional thumbnail for an online slot game in a casino lobby, landscape.',
    `Main subject: ${cast || 'the game\'s main character'}, charismatic and expressive, dynamic pose, looking at the viewer, large and filling the upper two thirds.`,
    `Background: ${g.scene}, lush and detailed, cinematic lighting, strong depth, vivid saturated colors, glowing rim light on the character.`,
    `In the lower third, overlapping the character: a huge bold 3D game logo that reads exactly ${logoText(g.name)} — chunky beveled letters with a glossy gold/theme-colored face, thick dark outline, subtle drop shadow, slightly arched, decorated with small theme ornaments. Accent color ${g.accent}.`,
    'Composition: keep the character\'s face and the whole logo inside the central 85% of the width (the left and right edges will be cropped to 4:3).',
    'Style: high-end painterly 2.5D game illustration, crisp, polished, like premium slot game key art.',
    withRef ? 'The attached pictures are this game\'s own artwork: keep the same character designs, costume, colors and painting style.' : '',
    'No other text, no UI, no buttons, no borders, no watermark, no company logos. Never add ™, ® or © signs after any word of the logo.'
  ].filter(Boolean).join(' ');
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function callApi(g, dest, withRef) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const quality = process.env.OPENAI_THUMB_QUALITY || 'high';
  const refs = withRef ? [g.hero && g.hero.image, g.wild && g.wild.image, g.stage].filter(Boolean).map((u) => path.join(PUBLIC, u)).filter((f) => fs.existsSync(f)) : [];
  let fidelity = true;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    if (refs.length) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt(g, true));
      form.append('size', '1536x1024');
      form.append('quality', quality);
      if (fidelity) form.append('input_fidelity', 'high');
      for (const f of refs) form.append('image[]', new Blob([fs.readFileSync(f)], { type: MIME[path.extname(f).toLowerCase()] || 'image/png' }), path.basename(f));
      res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    } else {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: prompt(g, false), size: '1536x1024', quality, output_format: 'png', n: 1 })
      });
    }
    const data = await res.json().catch(() => ({}));
    const b64 = data.data && data.data[0] && data.data[0].b64_json;
    if (res.ok && b64) {
      fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
      return;
    }
    const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
    if (res.status === 400 && fidelity && /input_fidelity/i.test(msg)) { fidelity = false; attempt--; continue; } // model without input_fidelity
    if (res.status === 400 || res.status === 401 || res.status === 403 || attempt === 3) throw new Error(`${g.id}: ${msg}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(`--${n}`);
  const games = artworkGames();
  const hasThumb = (id) => fs.existsSync(path.join(PUBLIC, 'games', id, 'assets', 'thumb.jpg'));

  if (flag('list') || !args.length) {
    for (const g of games) {
      const raw = fs.existsSync(path.join(OUT, `${g.id}.png`));
      console.log(`${g.id.padEnd(30)} ${hasThumb(g.id) ? 'in lobby' : raw ? 'painted, not imported' : '—'}   hero: ${g.hero ? g.hero.name : '?'}`);
    }
    if (!args.length) console.log('\nUsage: node scripts/gen-thumbs.js <id…> | --all  [--dry] [--force] [--no-ref]');
    return;
  }
  const ids = args.filter((a) => !a.startsWith('--'));
  const pick = games.filter((g) => (flag('all') ? true : ids.includes(g.id)));
  const unknown = ids.filter((id) => !games.find((g) => g.id === id));
  if (unknown.length) throw new Error(`Not an artwork game: ${unknown.join(', ')} (see --list)`);
  if (!pick.length) throw new Error('No games selected');

  fs.mkdirSync(OUT, { recursive: true });
  const withRef = !flag('no-ref');
  const jobs = [];
  for (const g of pick) {
    const dest = path.join(OUT, `${g.id}.png`);
    if (flag('dry')) { console.log(`\n# ${g.id}\n${prompt(g, withRef)}`); continue; }
    if (!flag('force') && (fs.existsSync(dest) || hasThumb(g.id))) continue;
    jobs.push(async () => {
      const t0 = Date.now();
      await callApi(g, dest, withRef);
      console.log(`✔ ${g.id}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    });
  }
  if (flag('dry')) return;
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set (put it into SpinKit/.env)');
  console.log(`${jobs.length} thumbnail(s) to paint…`);
  let i = 0;
  let failed = 0;
  await Promise.all(Array.from({ length: Number(process.env.OPENAI_CONCURRENCY || 3) }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      try { await job(); } catch (e) { failed++; console.error(`✗ ${e.message}`); }
    }
  }));
  console.log(failed ? `${failed} failed — run the same command again to retry them` : 'done. Next: python3 scripts/import-thumbs.py --all');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
