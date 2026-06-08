// Phase B fragmentlarini (src/i18n/locales/_pending/*.json) uz/ru/zh.json ga
// deep-merge qiladi. Har fragment: { "uz": {...}, "ru": {...}, "zh": {...} }.
// Merge'dan keyin _pending fayllari o'chiriladi.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const pendingDir = path.join(dir, '_pending');
const langs = ['uz', 'ru', 'zh'];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const deepMerge = (target, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (isObj(v) && isObj(target[k])) deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
};

if (!fs.existsSync(pendingDir)) { console.log('ℹ _pending yo\'q — merge qilinmadi.'); process.exit(0); }
const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith('.json')).sort();
if (!files.length) { console.log('ℹ Fragment yo\'q.'); process.exit(0); }

const base = {};
for (const lng of langs) base[lng] = JSON.parse(fs.readFileSync(path.join(dir, `${lng}.json`), 'utf8'));

for (const f of files) {
  const frag = JSON.parse(fs.readFileSync(path.join(pendingDir, f), 'utf8'));
  for (const lng of langs) if (frag[lng]) deepMerge(base[lng], frag[lng]);
  console.log(`  merged ${f}`);
}

for (const lng of langs) {
  fs.writeFileSync(path.join(dir, `${lng}.json`), JSON.stringify(base[lng], null, 2) + '\n', 'utf8');
}
for (const f of files) fs.rmSync(path.join(pendingDir, f));
fs.rmdirSync(pendingDir, { recursive: true });
console.log(`✅ ${files.length} ta fragment ${langs.join('/')}.json ga birlashtirildi (_pending tozalandi).`);
