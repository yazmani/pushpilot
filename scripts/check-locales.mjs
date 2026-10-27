// Checks every built locale against English: same messages, same $1–$9
// placeholders, and the manifest limits Chrome enforces. Reads the
// _locales/*/messages.json that WXT generates from src/locales/*.yml.
//
//   npm run build && node scripts/check-locales.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../dist/chrome-mv3/_locales', import.meta.url));
const load = (locale) =>
  new Map(Object.entries(JSON.parse(readFileSync(join(dir, locale, 'messages.json'), 'utf8'))).map(([k, v]) => [k, v.message]));
const placeholders = (s) => [...new Set(s.match(/\$\d/g) ?? [])].sort().join(',');

const en = load('en');
let problems = 0;
const report = (locale, msg) => {
  problems++;
  console.log(`${locale}: ${msg}`);
};

const locales = readdirSync(dir).filter((l) => l !== 'en');
for (const locale of locales) {
  const t = load(locale);
  for (const [key, text] of en) {
    if (key.startsWith('@@')) continue;
    const tr = t.get(key);
    if (tr === undefined) report(locale, `missing ${key}`);
    else if (placeholders(tr) !== placeholders(text))
      report(locale, `${key}: placeholders ${placeholders(tr)} ≠ ${placeholders(text)}`);
  }
  for (const key of t.keys()) if (!en.has(key)) report(locale, `extra ${key}`);
  if ((t.get('extName') ?? '').length > 75) report(locale, 'extName is over 75 characters');
  if ((t.get('extDescription') ?? '').length > 132) report(locale, 'extDescription is over 132 characters');
}
console.log(problems ? `${problems} problem(s) in ${locales.length} locales` : `${locales.length} locales match English`);
process.exit(problems ? 1 : 0);
