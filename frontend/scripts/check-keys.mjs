// Statik t('...') / i18n.t('...') kalitlari uz.json'da mavjudligini tekshiradi.
// Dinamik t(variable) chaqiruvlari (tirnoqsiz) e'tiborga olinmaydi.
// Plural: t('x.count') uchun 'x.count_one'/'_other' va h.k. ham qabul qilinadi.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const uz = JSON.parse(fs.readFileSync(path.join(srcDir, 'i18n', 'locales', 'uz.json'), 'utf8'));

const flat = new Set();
(function walk(o, p = '') {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key);
    else flat.add(key);
  }
})(uz);

const PLURAL = ['', '_other', '_one', '_few', '_many', '_zero', '_two'];
const has = (k) => PLURAL.some((s) => flat.has(k + s));

const files = [];
(function collect(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) {
      if (['locales', '_pending', 'node_modules'].includes(e.name)) continue;
      collect(fp);
    } else if (/\.(jsx?|tsx?)$/.test(e.name) && !e.name.endsWith('.test.js')) files.push(fp);
  }
})(srcDir);

const re = /\bt\(\s*['"`]([^'"`$]+)['"`]/g; // t('key') / i18n.t('key'); $ ni inkor → template-interp o'tkazib yuboriladi
const missing = new Map();
for (const fp of files) {
  const code = fs.readFileSync(fp, 'utf8');
  let m;
  while ((m = re.exec(code))) {
    const key = m[1];
    if (!key.includes('.')) continue; // namespace'siz literal — kalit emas
    if (!has(key)) {
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key).add(path.relative(root, fp));
    }
  }
}

if (missing.size) {
  console.error(`❌ ${missing.size} ta t() kaliti uz.json'da topilmadi:`);
  for (const [k, fps] of missing) console.error(`   ${k}  ← ${[...fps].join(', ')}`);
  process.exit(1);
}
console.log(`✅ Barcha statik t() kalitlari uz.json'da mavjud (${flat.size} kalit).`);
