#!/usr/bin/env node
/**
 * Checks the game dictionaries in public/games/<game>/lang/*.json against en.json:
 * every key present (plural keys: `.other` at least), the same {placeholders}, the same HTML tags.
 *
 *   node scripts/check-i18n.js            # all games, all languages
 *   node scripts/check-i18n.js de pl      # only these languages
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../public/games');
const only = process.argv.slice(2);
const PLURAL = /\.(zero|one|two|few|many|other)$/;
const vars = (s) => [...new Set((String(s).match(/\{\w+\}/g) || []))].sort().join(' ');
const tags = (s) => (String(s).match(/<\/?[a-z]+[^>]*>/gi) || []).map((x) => x.replace(/\s.*>/, '>')).sort().join(' ');

let problems = 0;
const say = (m) => { problems++; console.log(`  ✗ ${m}`); };

for (const game of fs.readdirSync(ROOT)) {
  const dir = path.join(ROOT, game, 'lang');
  if (!fs.existsSync(path.join(dir, 'en.json'))) continue;
  const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
  const plainKeys = Object.keys(en).filter((k) => !PLURAL.test(k));
  const pluralBases = [...new Set(Object.keys(en).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')))];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
    const lang = file.replace('.json', '');
    if (only.length && !only.includes(lang)) continue;
    console.log(`${game}/${lang}`);
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { say(`invalid JSON: ${e.message}`); continue; }
    for (const k of plainKeys) {
      if (d[k] == null) { say(`missing ${k}`); continue; }
      if (typeof d[k] !== 'string') { say(`${k} is not a string`); continue; }
      if (vars(d[k]) !== vars(en[k])) say(`${k}: placeholders ${vars(d[k]) || '-'} ≠ ${vars(en[k]) || '-'}`);
      if (tags(d[k]) !== tags(en[k])) say(`${k}: HTML tags differ`);
    }
    for (const base of pluralBases) {
      if (d[`${base}.other`] == null) { say(`missing ${base}.other`); continue; }
      const ref = vars(en[`${base}.other`]);
      for (const k of Object.keys(d).filter((x) => x.startsWith(`${base}.`) && PLURAL.test(x))) {
        // a form may drop {n} (e.g. "one fruit"), but must not invent placeholders
        const extra = vars(d[k]).split(' ').filter((v) => v && !ref.includes(v));
        if (extra.length) say(`${k}: unknown placeholders ${extra.join(' ')}`);
      }
    }
    for (const k of Object.keys(d)) {
      if (en[k] == null && !(PLURAL.test(k) && pluralBases.includes(k.replace(PLURAL, '')))) say(`unknown key ${k}`);
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : '\nAll dictionaries match en.json.');
process.exit(problems ? 1 : 0);
