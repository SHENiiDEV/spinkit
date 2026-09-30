#!/usr/bin/env node
/**
 * Procedural artwork for the games (dev tool, needs Playwright).
 *
 *   node scripts/gen-art.js --list                       # games that have an art module
 *   node scripts/gen-art.js gold_rush_canyon             # paint one game (stage.jpg + symbols)
 *   node scripts/gen-art.js giants [--only <id>] [--force]   # all giant skins (or one)
 *   node scripts/gen-art.js --all                        # everything
 *   node scripts/gen-art.js <game|giants|--all> --cover http://localhost:3000   # lobby cover.jpg from the running server (any game)
 *
 * Art modules live in scripts/art/games/<name>.js (see scripts/art/runner.js for the format).
 * Any generated file can be replaced by painted artwork of the same size.
 */
const fs = require('node:fs');
const path = require('node:path');
const { launch, paintCabinet, makeCover } = require('./art/runner');

const DIR = path.join(__dirname, 'art/games');
const MODULES = Object.fromEntries(fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).map((f) => [f.replace(/\.js$/, ''), require(path.join(DIR, f))]));

const args = process.argv.slice(2);
const opt = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const flag = (name) => args.includes(`--${name}`);
const valueOf = new Set(['only', 'cover'].map((n) => args.indexOf(`--${n}`) + 1).filter((i) => i > 0));
const target = args.find((a, i) => !a.startsWith('--') && !valueOf.has(i));

/** Game ids an art module covers. */
const idsOf = (name, mod) => (mod.games ? mod.games : [mod.game || name]);

async function main() {
  if (flag('list') || (!target && !flag('all'))) {
    console.log('Art modules:');
    for (const [name, mod] of Object.entries(MODULES)) console.log(`  ${name.padEnd(24)} ${idsOf(name, mod).join(', ')}`);
    if (!flag('list')) console.log('\nUsage: node scripts/gen-art.js <module|game_id|--all> [--only id] [--force] [--cover url]');
    return;
  }
  // a module name, or a game id covered by a module (e.g. cleopatra_giants -> giants --only cleopatra_giants)
  let picks = flag('all') ? Object.keys(MODULES) : [target];
  let only = opt('only');
  if (!flag('all') && !MODULES[target]) {
    const owner = Object.entries(MODULES).find(([name, mod]) => idsOf(name, mod).includes(target));
    if (!owner && opt('cover')) {
      // painted games have no art module, but a lobby cover can still be shot from the client
      const browser = await launch();
      try { await makeCover(browser, opt('cover'), target); } finally { await browser.close(); }
      return;
    }
    if (!owner) throw new Error(`No art module for "${target}". Run with --list.`);
    picks = [owner[0]];
    only = target;
  }

  const browser = await launch();
  try {
    for (const name of picks) {
      const mod = MODULES[name];
      if (opt('cover')) {
        for (const id of idsOf(name, mod).filter((x) => !only || x === only)) await makeCover(browser, opt('cover'), id);
      } else if (mod.run) {
        await mod.run(browser, { only, force: flag('force') });
      } else {
        await paintCabinet(browser, mod);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
