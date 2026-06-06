// Re-render concept HTML files (concept-N.html) to light+dark PNGs and build two
// 2x3 contact sheets (contacts-light.png / contacts-dark.png) for side-by-side review.
//
// Run from anywhere:  node handoff/concepts/render-concepts.mjs
// (Playwright is resolved from frontend/node_modules; Chromium must be installed there.)
import { createRequire } from 'node:module';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(DIR)); // repo root
const require = createRequire(ROOT + '/frontend/package.json');
const { chromium } = require('playwright');
const fileUrl = p => 'file://' + p.replace(/\\/g, '/');

const labels = existsSync(`${DIR}/labels.json`)
  ? JSON.parse(readFileSync(`${DIR}/labels.json`, 'utf8')) : {};

const present = [];
for (let n = 1; n <= 6; n++) if (existsSync(`${DIR}/concept-${n}.html`)) present.push(n);
console.log('Concepts found:', present.join(', ') || '(none)');

const browser = await chromium.launch();

for (const n of present) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
  await page.goto(fileUrl(`${DIR}/concept-${n}.html`), { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${DIR}/concept-${n}-light.png`, fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${DIR}/concept-${n}-dark.png`, fullPage: true });
  await page.close();
  console.log(`rendered #${n} (${labels[n] || ''})`);
}

function sheetHtml(theme) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#11182a' : '#f4f5f7', card = isDark ? '#1b2336' : '#ffffff';
  const ink = isDark ? '#e8ecf5' : '#1a1814', sub = isDark ? '#8b93a7' : '#6b7280';
  const line = isDark ? '#2c3650' : '#e3e5ea', acc = isDark ? '#9aa3ff' : '#5b57e8';
  const cells = present.map(n => `
    <div class="cell">
      <div class="cap"><b>#${n}</b> ${(labels[n] || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
      <div class="shot"><img src="${fileUrl(`${DIR}/concept-${n}-${theme}.png`)}"/></div>
    </div>`).join('');
  return `<!doctype html><html${isDark ? ' class="dark"' : ''}><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:${bg};color:${ink};font-family:Inter,system-ui,sans-serif;padding:28px}
    h1{font-size:20px;margin:0 0 4px}.meta{color:${sub};font-size:13px;margin:0 0 22px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
    .cell{background:${card};border:1px solid ${line};border-radius:14px;overflow:hidden}
    .cap{padding:10px 14px;font-size:13.5px;border-bottom:1px solid ${line}}.cap b{color:${acc}}
    .shot{height:430px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center;background:${bg}}
    .shot img{width:100%;display:block}
  </style></head><body><h1>ERP — UX/UI konsepsiyalari · ${isDark ? 'Dark' : 'Light'} tema</h1>
    <p class="meta">Mijozlar (CRM) ro'yxat sahifasi · ${present.length} yo'nalish yonma-yon</p>
    <div class="grid">${cells}</div></body></html>`;
}

for (const theme of ['light', 'dark']) {
  if (!present.length) break;
  writeFileSync(`${DIR}/_sheet-${theme}.html`, sheetHtml(theme));
  const page = await browser.newPage({ viewport: { width: 1560, height: 1400 }, deviceScaleFactor: 1.5 });
  await page.goto(fileUrl(`${DIR}/_sheet-${theme}.html`), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/contacts-${theme}.png`, fullPage: true });
  await page.close();
  console.log(`contact sheet: contacts-${theme}.png`);
}

await browser.close();
console.log('DONE');
