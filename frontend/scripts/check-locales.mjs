// uz/ru/zh locale fayllari bir xil kalit to'plamiga ega ekanligini tekshiradi
// (i18next plural suffikslari _one/_few/_many/_other normallashtiriladi).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const langs = ['uz', 'ru', 'zh'];

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = true;
  }
  return out;
};
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');

const sets = {};
for (const lng of langs) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, `${lng}.json`), 'utf8'));
  sets[lng] = new Set(Object.keys(flatten(json)).map(base));
}

let bad = false;
for (const lng of ['ru', 'zh']) {
  const missing = [...sets.uz].filter((k) => !sets[lng].has(k));
  const extra = [...sets[lng]].filter((k) => !sets.uz.has(k));
  if (missing.length) { bad = true; console.error(`❌ ${lng}.json — ${missing.length} ta kalit yetishmaydi:`, missing.slice(0, 20)); }
  if (extra.length) { bad = true; console.error(`❌ ${lng}.json — ${extra.length} ta ortiqcha kalit:`, extra.slice(0, 20)); }
}
if (bad) { console.error('\nLocale parity FAILED.'); process.exit(1); }
console.log(`✅ Parity OK — ${sets.uz.size} kalit × ${langs.length} til.`);
