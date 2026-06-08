# Ko'p tillilik (i18n: UZ/RU/ZH) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Butun React UI'ni uchta tilda (O'zbek/Rus/Xitoy) taqdim etish — TopHeader'da globus dropdown almashtirgich, qurilmada saqlanadigan tanlov, locale-aware raqam/sana formatlash.

**Architecture:** `react-i18next` + lazy-loaded JSON locale fayllari (`uz` bundle bilan, `ru`/`zh` dinamik import). Mavjud `lib/format.js` chokepoint locale-aware qilinadi (Intl, til i18n qatlamidan `setFormatLocale` orqali beriladi — circular import yo'q). Hujjat/print shablonlari o'zbekcha qoladi (ko'lam tashqarisida).

**Tech Stack:** React 19.2, Vite 8, Tailwind v4 (CSS vars), react-i18next, i18next, i18next-resources-to-backend, i18next-browser-languagedetector, @fontsource/noto-sans-sc. Testlar: `node --test` (format.js), standalone parity script, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-06-08-i18n-multilanguage-design.md` · **Branch:** `feat/i18n-multilanguage`

---

## Fayl tuzilmasi

| Fayl | Mas'uliyat | Amal |
|---|---|---|
| `frontend/src/i18n/index.js` | i18next init, lazy-load, detector, locale→format ko'prigi, zh font lazy | Create |
| `frontend/src/i18n/locales/uz.json` | Manba kalitlar (o'zbekcha) | Create |
| `frontend/src/i18n/locales/ru.json` | Rus tarjimasi | Create |
| `frontend/src/i18n/locales/zh.json` | Xitoy tarjimasi (Simplified) | Create |
| `frontend/src/lib/format.js` | Locale-aware Intl formatlash (pure) | Modify |
| `frontend/src/lib/format.test.js` | format.js unit testi (`node --test`) | Create |
| `frontend/src/components/LanguageSwitcher.jsx` | Globus dropdown almashtirgich | Create |
| `frontend/scripts/check-locales.mjs` | Kalit parity tekshiruvi | Create |
| `frontend/src/main.jsx` | `import './i18n'` | Modify |
| `frontend/src/index.css` | `--sans` ga `'Noto Sans SC'` | Modify |
| `frontend/src/App.jsx` | Sidebar nav, TopHeader, Dashboard → `t()`; switcher mount | Modify |
| `frontend/src/pages/*.jsx` (12 ta) | Hardcoded matn → `t()` | Modify |
| `frontend/src/components/*.jsx` | Calendar/PeriodPicker/Pagination → `t()` | Modify |
| `frontend/package.json` | `i18n:check`, `test:format` skriptlar | Modify |
| `frontend/e2e/i18n.spec.js` | Almashtirgich E2E | Create |

**Kalit konventsiyasi:** nested JSON, namespace bo'yicha. Takrorlanadigan matn `common.*` ga (`common.save`, `common.cancel`, `common.delete`, `common.edit`, `common.close`, `common.notFound`, `common.loading`, `common.all`, `common.restore`). Sahifaga xos — `<page>.*` (masalan `clients.title`). Birliklar — `units.*`. Validatsiya — `validation.*`. Plural — i18next suffikslari (`key_one/_few/_many/_other`). Interpolatsiya — `{{var}}`.

---

# PHASE A — Infratuzilma

### Task 1: Bog'liqliklarni o'rnatish

**Files:**
- Modify: `frontend/package.json` (scripts)

- [ ] **Step 1: Kutubxonalarni o'rnatish**

Run:
```bash
cd frontend && npm i i18next react-i18next i18next-resources-to-backend i18next-browser-languagedetector @fontsource/noto-sans-sc
```
Expected: `added N packages`, xatosiz.

- [ ] **Step 2: package.json ga skriptlar qo'shish**

`frontend/package.json` → `"scripts"` blokiga qo'shing:
```json
    "i18n:check": "node scripts/check-locales.mjs",
    "test:format": "node --test src/lib/format.test.js"
```

- [ ] **Step 3: Commit**
```bash
git add package.json package-lock.json && git commit -m "chore(i18n): react-i18next va font bog'liqliklari"
```

---

### Task 2: `format.js` — locale-aware (TDD)

**Files:**
- Create: `frontend/src/lib/format.test.js`
- Modify: `frontend/src/lib/format.js`

- [ ] **Step 1: Failing test yozish**

`frontend/src/lib/format.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtDate, setFormatLocale } from './format.js';

test('fmt — locale bo\'yicha guruhlash', () => {
  setFormatLocale('zh-CN');
  assert.equal(fmt(1234567), '1,234,567');          // zh-CN → vergul
  setFormatLocale('ru-RU');
  assert.notEqual(fmt(1234567), '1,234,567');        // ru-RU → bo'sh joy (vergul emas)
  assert.equal(fmt(0), '0');
  assert.equal(fmt(null), '0');
});

test('fmtDate — locale bo\'yicha maydon tartibi', () => {
  const d = new Date(2026, 2, 12); // 12-mart-2026 (lokal vaqt, TZ-xavfsiz)
  setFormatLocale('zh-CN');
  assert.match(fmtDate(d), /^2026/);                  // zh → yil oldinda
  setFormatLocale('ru-RU');
  assert.match(fmtDate(d), /^12/);                    // ru → kun oldinda
  setFormatLocale('uz-UZ');
});
```

- [ ] **Step 2: Test ishlamasligini tasdiqlash**

Run: `cd frontend && node --test src/lib/format.test.js`
Expected: FAIL — `setFormatLocale` eksport qilinmagan (`SyntaxError`/import xato).

- [ ] **Step 3: `format.js` ni qayta yozish**

`frontend/src/lib/format.js` to'liq mazmuni:
```js
// Locale-aware formatlash. Aktiv BCP-47 tag i18n qatlamidan (i18n/index.js)
// languageChanged'da beriladi — format.js toza qoladi (i18n import qilmaydi),
// shu sabab unit-test qilinadi va circular dependency yo'q.
let currentTag = 'uz-UZ';
const numCache = new Map();
const dateCache = new Map();
const dateTimeCache = new Map();

const num = (tag) => {
  if (!numCache.has(tag)) numCache.set(tag, new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }));
  return numCache.get(tag);
};
const dateF = (tag) => {
  if (!dateCache.has(tag)) dateCache.set(tag, new Intl.DateTimeFormat(tag));
  return dateCache.get(tag);
};
const dateTimeF = (tag) => {
  if (!dateTimeCache.has(tag)) dateTimeCache.set(tag, new Intl.DateTimeFormat(tag, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }));
  return dateTimeCache.get(tag);
};

export const setFormatLocale = (tag) => { currentTag = tag || 'uz-UZ'; };
export const getFormatLocale = () => currentTag;

export const fmt        = (n) => (!n && n !== 0) ? '0' : num(currentTag).format(Math.round(n));
export const fmtOrDash  = (n) => (!n && n !== 0) ? '—' : num(currentTag).format(Math.round(n));
export const fmtDate    = (d) => d ? dateF(currentTag).format(new Date(d)) : '—';
export const fmtDateTime = (d) => d ? dateTimeF(currentTag).format(new Date(d)) : '—';

// Foydalanuvchi id'sidan deterministik rang (audit "kim" ustuni). Faqat UI.
export const userColor = (id) => {
  if (!id) return 'var(--text-3)';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 45%)`;
};
```

- [ ] **Step 4: Test o'tishini tasdiqlash**

Run: `cd frontend && node --test src/lib/format.test.js`
Expected: PASS — `2 tests passed`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/format.js src/lib/format.test.js && git commit -m "feat(i18n): format.js locale-aware Intl formatlash + test"
```

---

### Task 3: i18n init + seed locale fayllar + main.jsx

**Files:**
- Create: `frontend/src/i18n/index.js`
- Create: `frontend/src/i18n/locales/{uz,ru,zh}.json`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: `i18n/index.js` yaratish**

`frontend/src/i18n/index.js`:
```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import uz from './locales/uz.json';
import { setFormatLocale } from '../lib/format';

export const LANGS = [
  { code: 'uz', label: "O'zbek",  flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'zh', label: '中文',     flag: '🇨🇳' },
];

i18n
  // uz boshlang'ich bundle bilan keladi (flash yo'q); ru/zh code-split + lazy
  .use(resourcesToBackend((lng) => import(`./locales/${lng}.json`)))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { uz: { translation: uz } },
    partialBundledLanguages: true,
    fallbackLng: 'uz',
    supportedLngs: ['uz', 'ru', 'zh'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'erp_lang',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

const TAG = { uz: 'uz-UZ', ru: 'ru-RU', zh: 'zh-CN' };
let zhFontLoaded = false;

const applyLocale = (lng) => {
  const base = (lng || 'uz').split('-')[0];
  setFormatLocale(TAG[base] || 'uz-UZ');
  if (typeof document !== 'undefined') document.documentElement.lang = base;
  // Noto Sans SC faqat zh tanlanganda yuklanadi (CJK font og'ir)
  if (base === 'zh' && !zhFontLoaded) {
    zhFontLoaded = true;
    import('@fontsource/noto-sans-sc/400.css').catch(() => {});
    import('@fontsource/noto-sans-sc/500.css').catch(() => {});
  }
};

applyLocale(i18n.language);
i18n.on('languageChanged', applyLocale);

export default i18n;
```

- [ ] **Step 2: Seed locale fayllar (shell namespace bilan)**

`frontend/src/i18n/locales/uz.json` (boshlang'ich — Phase A shell kalitlari):
```json
{
  "common": {
    "save": "Saqlash", "saving": "Saqlanmoqda...", "cancel": "Bekor", "delete": "O'chirish",
    "edit": "Tahrirlash", "close": "Yopish", "all": "Barchasi", "notFound": "Topilmadi",
    "loading": "Yuklanmoqda...", "restore": "Tiklash", "newClient": "Yangi Mijoz", "export": "Eksport"
  },
  "nav": {
    "section": "Asosiy Bo'limlar",
    "dashboard": "Dashboard", "clients": "Mijozlar", "products": "Mahsulotlar",
    "contracts": "Shartnomalar", "sales": "Savdolar", "payments": "Tushumlar",
    "interactions": "Muloqotlar", "reports": "Hisobotlar", "settings": "Sozlamalar",
    "users": "Foydalanuvchilar", "audit": "Audit jurnali"
  },
  "titles": {
    "dashboard": "Dashboard", "clients": "Mijozlar (CRM)", "products": "Mahsulotlar katalogi",
    "contracts": "Shartnomalar", "sales": "Savdolar (Yuk xatlari)", "payments": "Tushumlar reyestri",
    "interactions": "Muloqotlar tarixi", "reports": "Tizim hisobotlari", "settings": "Tizim sozlamalari",
    "users": "Foydalanuvchilar (RBAC)", "audit": "Audit jurnali"
  },
  "header": {
    "menu": "Menyu", "searchClients": "Mijoz qidirish...", "userFallback": "Foydalanuvchi",
    "settings": "Sozlamalar", "logout": "Tizimdan chiqish", "logoutOk": "Xavfsiz ravishda tizimdan chiqildi.",
    "lightMode": "Yorug' rejim", "darkMode": "Qorong'u rejim"
  },
  "dashboard": {
    "subtitle": "Tizim holati va real vaqt statistikasi", "today": "Bugun",
    "totalDebt": "Umumiy Qarzdorlik", "totalDebtSub": "Faol qarzdorlik oboroti",
    "todaySales": "Bugungi Savdo", "todaySalesSub": "Bugungi yuk xatlari summasi",
    "activeClients": "Faol Mijozlar", "activeClientsSub": "CRM ro'yxatida",
    "monthlySales": "Oylik Savdo", "monthlySalesSub": "Oxirgi 6 oydagi sotuv dinamikasi (mln UZS)",
    "topDebtors": "Eng yirik qarzdorlar", "topDebtorsSub": "Oborot bo'yicha eng yuqori qarzlar",
    "noDebtors": "Qarzdorlar mavjud emas", "recentSales": "So'nggi savdolar",
    "recentSalesSub": "Tizimga kiritilgan oxirgi yuk xatlari", "noSales": "Hozircha sotuvlar kiritilmagan",
    "thDate": "Sana", "thWaybill": "Yuk xati №", "thClient": "Mijoz nomi", "thSum": "Summa"
  },
  "units": { "uzs": "UZS", "count": "ta" }
}
```

`frontend/src/i18n/locales/ru.json`:
```json
{
  "common": {
    "save": "Сохранить", "saving": "Сохранение...", "cancel": "Отмена", "delete": "Удалить",
    "edit": "Изменить", "close": "Закрыть", "all": "Все", "notFound": "Не найдено",
    "loading": "Загрузка...", "restore": "Восстановить", "newClient": "Новый клиент", "export": "Экспорт"
  },
  "nav": {
    "section": "Основные разделы",
    "dashboard": "Главная", "clients": "Клиенты", "products": "Товары",
    "contracts": "Договоры", "sales": "Продажи", "payments": "Поступления",
    "interactions": "Контакты", "reports": "Отчёты", "settings": "Настройки",
    "users": "Пользователи", "audit": "Журнал аудита"
  },
  "titles": {
    "dashboard": "Главная", "clients": "Клиенты (CRM)", "products": "Каталог товаров",
    "contracts": "Договоры", "sales": "Продажи (Накладные)", "payments": "Реестр поступлений",
    "interactions": "История контактов", "reports": "Системные отчёты", "settings": "Системные настройки",
    "users": "Пользователи (RBAC)", "audit": "Журнал аудита"
  },
  "header": {
    "menu": "Меню", "searchClients": "Поиск клиента...", "userFallback": "Пользователь",
    "settings": "Настройки", "logout": "Выйти из системы", "logoutOk": "Вы безопасно вышли из системы.",
    "lightMode": "Светлая тема", "darkMode": "Тёмная тема"
  },
  "dashboard": {
    "subtitle": "Состояние системы и статистика в реальном времени", "today": "Сегодня",
    "totalDebt": "Общая задолженность", "totalDebtSub": "Оборот активной задолженности",
    "todaySales": "Продажи сегодня", "todaySalesSub": "Сумма сегодняшних накладных",
    "activeClients": "Активные клиенты", "activeClientsSub": "В списке CRM",
    "monthlySales": "Продажи по месяцам", "monthlySalesSub": "Динамика продаж за последние 6 месяцев (млн UZS)",
    "topDebtors": "Крупнейшие должники", "topDebtorsSub": "Наибольшие долги по обороту",
    "noDebtors": "Должников нет", "recentSales": "Последние продажи",
    "recentSalesSub": "Последние внесённые накладные", "noSales": "Продажи пока не внесены",
    "thDate": "Дата", "thWaybill": "Накладная №", "thClient": "Клиент", "thSum": "Сумма"
  },
  "units": { "uzs": "UZS", "count": "шт" }
}
```

`frontend/src/i18n/locales/zh.json`:
```json
{
  "common": {
    "save": "保存", "saving": "保存中...", "cancel": "取消", "delete": "删除",
    "edit": "编辑", "close": "关闭", "all": "全部", "notFound": "未找到",
    "loading": "加载中...", "restore": "恢复", "newClient": "新客户", "export": "导出"
  },
  "nav": {
    "section": "主要模块",
    "dashboard": "仪表盘", "clients": "客户", "products": "产品",
    "contracts": "合同", "sales": "销售", "payments": "收款",
    "interactions": "联系记录", "reports": "报表", "settings": "设置",
    "users": "用户", "audit": "审计日志"
  },
  "titles": {
    "dashboard": "仪表盘", "clients": "客户 (CRM)", "products": "产品目录",
    "contracts": "合同", "sales": "销售 (货运单)", "payments": "收款登记",
    "interactions": "联系历史", "reports": "系统报表", "settings": "系统设置",
    "users": "用户 (RBAC)", "audit": "审计日志"
  },
  "header": {
    "menu": "菜单", "searchClients": "搜索客户...", "userFallback": "用户",
    "settings": "设置", "logout": "退出系统", "logoutOk": "已安全退出系统。",
    "lightMode": "浅色模式", "darkMode": "深色模式"
  },
  "dashboard": {
    "subtitle": "系统状态与实时统计", "today": "今天",
    "totalDebt": "总欠款", "totalDebtSub": "活跃应收账款周转",
    "todaySales": "今日销售", "todaySalesSub": "今日货运单金额",
    "activeClients": "活跃客户", "activeClientsSub": "CRM 列表中",
    "monthlySales": "月度销售", "monthlySalesSub": "近 6 个月销售动态 (百万 UZS)",
    "topDebtors": "最大欠款客户", "topDebtorsSub": "按周转额最高欠款",
    "noDebtors": "暂无欠款客户", "recentSales": "最近销售",
    "recentSalesSub": "系统最近录入的货运单", "noSales": "暂无销售记录",
    "thDate": "日期", "thWaybill": "货运单 №", "thClient": "客户名称", "thSum": "金额"
  },
  "units": { "uzs": "UZS", "count": "件" }
}
```

- [ ] **Step 3: `main.jsx` ga i18n import**

`frontend/src/main.jsx` — `import './index.css'` dan keyin qo'shing:
```js
import './i18n';
```

- [ ] **Step 4: Build sinovi (import yo'llari to'g'riligini tekshirish)**

Run: `cd frontend && npm run build`
Expected: muvaffaqiyatli build (`dist/` yangilanadi), import xatosi yo'q.

- [ ] **Step 5: Commit**
```bash
git add src/i18n src/main.jsx && git commit -m "feat(i18n): i18next init, lazy locales, uz/ru/zh seed (shell)"
```

---

### Task 4: Locale parity tekshiruvi

**Files:**
- Create: `frontend/scripts/check-locales.mjs`

- [ ] **Step 1: Skript yaratish**

`frontend/scripts/check-locales.mjs`:
```js
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
```

- [ ] **Step 2: Ishga tushirish**

Run: `cd frontend && npm run i18n:check`
Expected: `✅ Parity OK — N kalit × 3 til.`

- [ ] **Step 3: Commit**
```bash
git add scripts/check-locales.mjs && git commit -m "test(i18n): locale kalit parity skripti"
```

---

### Task 5: LanguageSwitcher (globus dropdown)

**Files:**
- Create: `frontend/src/components/LanguageSwitcher.jsx`
- Modify: `frontend/src/App.jsx` (import + TopHeader mount)

- [ ] **Step 1: Komponent yaratish**

`frontend/src/components/LanguageSwitcher.jsx`:
```jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { LANGS } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const code = (i18n.language || 'uz').split('-')[0];
  const current = LANGS.find(l => l.code === code) || LANGS[0];

  useEffect(() => {
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const pick = (c) => { i18n.changeLanguage(c); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 h-8 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition text-xs font-medium"
        title="Til / Язык / 语言"
        aria-label="Language"
      >
        <Globe size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={12} className="text-[var(--text-3)]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl py-1.5 z-50 animate-in">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--surface-2)] text-left"
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {current.code === l.code && <Check size={13} className="text-[var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TopHeader'ga ulash**

`frontend/src/App.jsx`:
1. Yuqori importlarga qo'shing (boshqa local importlar yonida, masalan `TrendChart` importidan keyin):
```js
import LanguageSwitcher from './components/LanguageSwitcher';
```
2. `TopHeader` ichida, o'ng blokda — `{DATE_ROUTES.includes(location.pathname) && <PeriodPicker />}` qatoridan **keyin**, Theme toggle tugmasidan **oldin** qo'shing:
```jsx
        {/* Til almashtirgich */}
        <LanguageSwitcher />
```

- [ ] **Step 3: Tekshiruv (dev)**

Run: `cd frontend && npm run dev` (backend ham ishlab tursin: `cd backend && node server.js`)
Brauzer: login qiling → TopHeader o'ng tomonda `🌐 O'zbek ▾` ko'rinadi → bosing → 🇺🇿/🇷🇺/🇨🇳 ro'yxati. 中文 ni tanlang → menyu (`仪表盘`, `客户`...) va Dashboard sarlavhalari xitoychaga o'tishi kerak (Task 6 dan keyin to'liq). Sahifani yangilang → til saqlanib qoladi (localStorage `erp_lang`).

- [ ] **Step 4: Commit**
```bash
git add src/components/LanguageSwitcher.jsx src/App.jsx && git commit -m "feat(i18n): globus dropdown til almashtirgich (TopHeader)"
```

---

### Task 6: App.jsx shell migratsiyasi (Sidebar + TopHeader + Dashboard)

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css` (font stack)

Bu task seed JSON kalitlaridan (Task 3) foydalanadi — yangi kalit kerak emas, faqat hardcoded matnni `t()` ga almashtirish.

- [ ] **Step 1: `useTranslation` ni shell komponentlariga ulash**

`frontend/src/App.jsx` yuqorisiga import:
```js
import { useTranslation } from 'react-i18next';
```
Har bir komponentda (`Sidebar`, `TopHeader`, `Dashboard`) boshida:
```js
  const { t } = useTranslation();
```

- [ ] **Step 2: Sidebar matnlarini almashtirish**

`rawNavItems` `name` larini kalitga aylantiring (render paytida `t()`):
```js
  const rawNavItems = [
    { name: 'nav.dashboard',    path: '/',             icon: LayoutDashboard },
    { name: 'nav.clients',      path: '/clients',      icon: Users,         module: 'clients' },
    { name: 'nav.products',     path: '/products',     icon: Box,           module: 'products' },
    { name: 'nav.contracts',    path: '/contracts',    icon: FileText,      module: 'contracts' },
    { name: 'nav.sales',        path: '/sales',        icon: ShoppingCart,  module: 'sales' },
    { name: 'nav.payments',     path: '/payments',     icon: CreditCard,    module: 'payments' },
    { name: 'nav.interactions', path: '/interactions', icon: MessageSquare, module: 'interactions' },
    { name: 'nav.reports',      path: '/reports',      icon: TrendingUp,    module: 'reports' },
    { name: 'nav.settings',     path: '/settings',     icon: Settings,      module: 'settings' },
  ];
```
Admin qo'shimchalari:
```js
    navItems.push({ name: 'nav.users', path: '/users', icon: Shield });
    navItems.push({ name: 'nav.audit', path: '/audit', icon: ScrollText });
```
Render joylarida `{item.name}` → `{t(item.name)}` (ikkita joy: `title={isCollapsed ? t(item.name) : ''}` va `<span className="truncate">{t(item.name)}</span>`). "Asosiy Bo'limlar" → `{t('nav.section')}`. "Yopish" → `{t('common.close')}`.

- [ ] **Step 3: TopHeader matnlarini almashtirish**

`titles` xaritasini kalitlarга:
```js
  const titles = {
    '/': 'titles.dashboard', '/clients': 'titles.clients', '/products': 'titles.products',
    '/contracts': 'titles.contracts', '/sales': 'titles.sales', '/payments': 'titles.payments',
    '/interactions': 'titles.interactions', '/reports': 'titles.reports', '/settings': 'titles.settings',
    '/users': 'titles.users', '/audit': 'titles.audit',
  };
```
Render: `{titles[location.pathname] ? t(titles[location.pathname]) : 'NexERP'}`. Qolganlari:
- `toast.success('Xavfsiz...')` → `toast.success(t('header.logoutOk'))`
- hamburger `title="Menyu"` → `title={t('header.menu')}`
- search `placeholder="Mijoz qidirish..."` → `placeholder={t('header.searchClients')}`
- theme `title={theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}` → `title={t(theme === 'dark' ? 'header.lightMode' : 'header.darkMode')}`
- `{user?.username || 'Foydalanuvchi'}` → `{user?.username || t('header.userFallback')}`
- user menu "Sozlamalar" → `{t('header.settings')}`, "Tizimdan chiqish" → `{t('header.logout')}`

- [ ] **Step 4: Dashboard matnlari + inline sanalar**

- "Dashboard" sarlavha → `{t('nav.dashboard')}`; subtitle → `{t('dashboard.subtitle')}`
- `Bugun · {new Date().toLocaleDateString('uz-UZ')}` → `{t('dashboard.today')} · {fmtDate(new Date())}` (import: `import { fmt, fmtDate } from './lib/format';`)
- "Yangi Mijoz" → `{t('common.newClient')}`
- cards massivida `title`/`sub` qiymatlarini kalitга, render paytida `t()`:
```js
  const cards = stats ? [
    { title: 'dashboard.totalDebt', value: fmt(stats.totalDebt), unit: t('units.uzs'), sub: 'dashboard.totalDebtSub', tone: 'danger', badgeClass: 'icon-badge-danger', icon: TrendingDown },
    { title: 'dashboard.todaySales', value: fmt(stats.todayTotal), unit: t('units.uzs'), sub: 'dashboard.todaySalesSub', tone: 'success', badgeClass: 'icon-badge-success', icon: TrendingUp },
    { title: 'dashboard.activeClients', value: stats.clientsCount, unit: t('units.count'), sub: 'dashboard.activeClientsSub', tone: 'info', badgeClass: 'icon-badge-info', icon: Users },
  ] : [];
```
Render: `{c.title}` → `{t(c.title)}`, `{c.sub}` → `{t(c.sub)}`.
- "Oylik Savdo"/"Oxirgi 6 oy..." → `{t('dashboard.monthlySales')}` / `{t('dashboard.monthlySalesSub')}`; "Eksport" → `{t('common.export')}`
- "Eng yirik qarzdorlar"/sub → `dashboard.topDebtors`/`dashboard.topDebtorsSub`; "Qarzdorlar mavjud emas" → `dashboard.noDebtors`
- "So'nggi savdolar"/sub → `dashboard.recentSales`/`dashboard.recentSalesSub`; "Barchasi" → `common.all`; "Hozircha sotuvlar kiritilmagan" → `dashboard.noSales`
- jadval `th`: Sana/Yuk xati №/Mijoz nomi/Summa → `dashboard.thDate/thWaybill/thClient/thSum`
- `{new Date(s.date).toLocaleDateString('uz-UZ')}` → `{fmtDate(s.date)}`
- `{fmt(s.totalAmount)} UZS` → `{fmt(s.totalAmount)} {t('units.uzs')}`
- App yuklanish ekrani "Yuklanmoqda..." (App komponenti `t` ishlatmaydi — bu joy uchun `useTranslation` qo'shish o'rniga kalit ishlatmasdan qoldiring yoki `i18n.t('common.loading')` import qiling). Soddalik uchun: `import i18n from './i18n'` va `{i18n.t('common.loading')}`.

- [ ] **Step 5: Noto Sans SC font stack**

`frontend/src/index.css` 36-qator:
```css
  --sans: 'Inter', Geist, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- [ ] **Step 6: Tekshiruv**

Run: `cd frontend && npm run dev`
Brauzerda: 3 tilni almashtiring → Sidebar menyu, TopHeader sarlavha, Dashboard kartalar/jadval to'liq tarjimon bo'lishi; zh da sana `2026/...` tartibida, ieroglif to'g'ri ko'rinishi.
Run: `npm run i18n:check` → Parity OK. `npm run lint` → 0 xato.

- [ ] **Step 7: Commit**
```bash
git add src/App.jsx src/index.css && git commit -m "feat(i18n): App shell (nav, header, dashboard) tarjima + zh font"
```

---

## ✅ CHECKPOINT (Phase A oxiri)
Shell to'liq 3 tilda ishlaydi, almashtirgich saqlanadi, format locale-aware. Bu — qolgan sahifalar uchun **shablon**. Foydalanuvchiga ko'rsating va tasdiqdan keyin Phase B ga o'ting.

---

# PHASE B — Sahifalar migratsiyasi

**Standart protsedura (har sahifa uchun):**
1. Sahifa komponent(lar)iga `import { useTranslation } from 'react-i18next';` + `const { t } = useTranslation();`.
2. Inventardagi har bir hardcoded matnni `t('<namespace>.<key>')` ga almashtirish; takrorni `common.*`/`units.*`/`validation.*` ga yo'naltirish (yangi `common` kaliti kerak bo'lsa, uchala JSON ga qo'shing).
3. O'zbekcha qiymatni `uz.json` ga, rus → `ru.json`, xitoy → `zh.json` (glossariyga rioya — spec 5-bo'lim).
4. Interpolatsiya: `t('key', { count, name })` + JSON da `{{count}}`. Plural: `key_one/_few/_many/_other` (faqat ru to'liq; uz `_one/_other`; zh `_other`).
5. Sana/raqam: barcha inline `toLocaleDateString('uz-UZ'/'ru-RU')` ni `fmtDate`/`fmtDateTime` ga; `fmt()` allaqachon locale-aware.
6. `npm run i18n:check` → Parity OK.
7. `npm run lint` → 0 xato; brauzerda 3 tilni shu sahifada ko'rish (forma, jadval, toast, bo'sh holat).
8. Commit: `feat(i18n): <Sahifa> tarjima (uz/ru/zh)`.

**Parallel bajarish (tavsiya):** Phase B — 13 ta mustaqil sahifa. `subagent-driven-development` yoki Workflow bilan har sahifaga 1 agent, **Login (Task 8) shabloni** bo'yicha. Umumiy `common`/`units`/`validation` kalitlari to'qnashmasligi uchun: agentlar faqat o'z `<page>` namespace blokini qo'shadi; `common` ga yangi kalit kerak bo'lsa, sintez bosqichida birlashtiriladi va `i18n:check` bilan tekshiriladi.

---

### Task 8: Login.jsx — TO'LIQ NAMUNA (shablon)

**Files:**
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/i18n/locales/{uz,ru,zh}.json` (`login` namespace)
- (ixtiyoriy) Modify: Login sahifasiga `LanguageSwitcher` (login ekranida ham til tanlash uchun)

- [ ] **Step 1: `login` namespace qo'shish (uchala JSON)**

`uz.json` ga:
```json
  "login": {
    "title": "NexERP Tizimiga Kirish",
    "subtitle": "Davom etish uchun hisob ma'lumotlaringizni kiriting",
    "username": "Foydalanuvchi nomi", "usernamePh": "Masalan: admin",
    "password": "Parol", "remember": "Eslab qolish", "forgot": "Parolni unutdingizmi?",
    "submit": "Tizimga Kirish", "ssl": "SSL Himoyalangan & Shifrlangan Aloqa",
    "fillAll": "Iltimos, barcha maydonlarni to'ldiring!", "welcome": "Xush kelibsiz!",
    "forgotMsg": "Parolni tiklash uchun administrator bilan bog'laning."
  }
```
`ru.json` ga:
```json
  "login": {
    "title": "Вход в систему NexERP",
    "subtitle": "Введите учётные данные для продолжения",
    "username": "Имя пользователя", "usernamePh": "Например: admin",
    "password": "Пароль", "remember": "Запомнить меня", "forgot": "Забыли пароль?",
    "submit": "Войти в систему", "ssl": "Защищённое SSL и шифрованное соединение",
    "fillAll": "Пожалуйста, заполните все поля!", "welcome": "Добро пожаловать!",
    "forgotMsg": "Для сброса пароля обратитесь к администратору."
  }
```
`zh.json` ga:
```json
  "login": {
    "title": "登录 NexERP 系统",
    "subtitle": "请输入您的账户信息以继续",
    "username": "用户名", "usernamePh": "例如：admin",
    "password": "密码", "remember": "记住我", "forgot": "忘记密码？",
    "submit": "登录系统", "ssl": "SSL 保护与加密连接",
    "fillAll": "请填写所有字段！", "welcome": "欢迎！",
    "forgotMsg": "如需重置密码，请联系管理员。"
  }
```

- [ ] **Step 2: Login.jsx — `t()` ga almashtirish**

`import` qatoriga: `import { useTranslation } from 'react-i18next';`
Komponent boshida: `const { t } = useTranslation();`
Almashtirishlar:
| Joy | Eski | Yangi |
|---|---|---|
| toast (14-q) | `'Iltimos, barcha maydonlarni to\'ldiring!'` | `t('login.fillAll')` |
| toast (22-q) | `'Xush kelibsiz!'` | `t('login.welcome')` |
| h2 (84-q) | `NexERP Tizimiga Kirish` | `{t('login.title')}` |
| p (87-q) | `Davom etish...kiriting` | `{t('login.subtitle')}` |
| label (95-q) | `Foydalanuvchi nomi` | `{t('login.username')}` |
| input ph (105-q) | `"Masalan: admin"` | `placeholder={t('login.usernamePh')}` |
| label (121-q) | `Parol` | `{t('login.password')}` |
| span (162-q) | `Eslab qolish` | `{t('login.remember')}` |
| toast (166-q) | `'Parolni tiklash...bog\'laning.'` | `t('login.forgotMsg')` |
| button (170-q) | `Parolni unutdingizmi?` | `{t('login.forgot')}` |
| button (191-q) | `Tizimga Kirish` | `{t('login.submit')}` |
| footer (204-q) | `SSL Himoyalangan &amp; Shifrlangan Aloqa` | `{t('login.ssl')}` |

(Parol placeholder `••••••••` — o'zgarmaydi.)

- [ ] **Step 3: (ixtiyoriy) Login ekraniga almashtirgich**

Login `import` ga `import LanguageSwitcher from '../components/LanguageSwitcher';` va karta ustki o'ng burchagiga joylashtiring (Card `<div>` ichida, "Top accent line" dan keyin):
```jsx
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
```

- [ ] **Step 4: Tekshiruv + commit**
```bash
cd frontend && npm run i18n:check && npm run lint
git add src/pages/Login.jsx src/i18n/locales && git commit -m "feat(i18n): Login sahifasi tarjima (uz/ru/zh)"
```

---

### Tasks 9–20: Qolgan sahifalar (Login shabloni + standart protsedura)

Har biri uchun: yangi `<page>` namespace, inventardagi kategoriyalarni qoplash, ko'rsatilgan interpolatsiya/plural kalitlari. Inventar manbasi: spec 2-bo'lim + workflow natijasi.

- [ ] **Task 9 — `Clients.jsx`** (~127 matn) · namespace `clients` + `validation`. Maxsus: filter tablar (`common`/`clients`: Barchasi/Qarzdorlar/Haqdorlar/Yangi), status (`status.*`: yangi/faol/kutilmoqda/o'tgan/o'chirilgan), validatsiya (INN 9 raqam, hisob 20 raqam, MFO 5 raqam, telefon +998), `clients.count` plural (`_one/_few/_many`), `window.confirm` matnlari → `t()`. **Commit.**

- [ ] **Task 10 — `Products.jsx`** (~45) · namespace `products` + `units`. Maxsus: o'lcham birliklari (m²/m³/kg/tonna → `units`), `products.applyToVisible` interpolatsiya `{{count}}`, print preview matni, validatsiya. **Commit.**

- [ ] **Task 11 — `Sales.jsx`** (~94) · namespace `sales` + `units`. Maxsus: faktura status (`sales.invoiceSent`/`invoiceNotSent`), bulk `sales.selectedCount` plural, `sales.deleteCount` plural interpolatsiya, agregat kartalar (Jami Summa/Hajm/Og'irlik/Yuza). **MUHIM:** ekrandagi print shabloni (`YUK XATI №`, `Mijoz:`, `Nomi/Dona/Narx/Summa`) — **o'zbekcha qoldiring** (hujjat, ko'lam tashqarisida; kerak bo'lsa `sales.print.*` namespace bilan ajratib, lekin tarjima qilmasdan). **Commit.**

- [ ] **Task 12 — `Payments.jsx`** (~31) · namespace `payments`. Maxsus: `payments.count` plural, "Jami:" prefiks + `fmt()`, validatsiya. **Commit.**

- [ ] **Task 13 — `Contracts.jsx`** (~95) · namespace `contracts` + `units` + `validation`. Maxsus: status (yangi/amalda/yopilgan), ogohlantirish matnlari (`contracts.warnSpecExceed` interpolatsiya `{{spec}}`,`{{total}}`), eksport tugmalari (PDF/Word/Excel — brend nomlari qoladi, action tarjima), `№{{number}}` interpolatsiya. **Commit.**

- [ ] **Task 14 — `Reports.jsx`** (~127) · namespace `reports` + `units`. Maxsus: menyu (12), KPI kartalar, jadval `th` (Debet/Kredit/Balans — buxgalteriya atamalari, glossariyga muvofiq), `reports.docCount`/`reports.clientCount` plural, widget config yorliqlари. **Commit.**

- [ ] **Task 15 — `Users.jsx`** (~44) · namespace `users`. Maxsus: rollar (Super Admin/Admin/Sotuvchi/Foydalanuvchi → `users.role.*`), `MODULE_LABELS` obyektini `t()` ga (huquq matritsasi), parol hint shartli, ogohlantirish (admin huquqlari). **Commit.**

- [ ] **Task 16 — `Audit.jsx`** (~28) · namespace `audit`. Maxsus: `ENTITY_TYPES`/`ACTIONS` label larini `t()` (value=backend enum qoladi), pagination `{{start}}–{{end}} / {{total}}` + `audit.recordCount` plural, modal subtitle. **Commit.**

- [ ] **Task 17 — `Interactions.jsx`** (~40) · namespace `interactions`. Maxsus: tur yorliqlari (Qo'ng'iroq/Uchrashuv/Email/Boshqa → `interactions.type.*`, `TYPE_ICONS` bilan sinxron), `window.confirm` matnlari. **Commit.**

- [ ] **Task 18 — `Settings.jsx`** (~29) · namespace `settings`. Maxsus: QQS yorlig'i (→ `settings.vat`), `Oxirgi yangilanish: {{date}}` interpolatsiya + `fmtDateTime`, zaxira bo'limi. **Commit.**

- [ ] **Task 19 — `components/Calendar.jsx` + `PeriodPicker.jsx`** (~28) · namespace `calendar`. Maxsus: oylar (12) va hafta kunlari (7) massivlarini `t('calendar.months', { returnObjects: true })` yoki indeksli kalitlar; preset yorliqlari (Bugun/Kecha/Shu hafta...). **Commit.**

- [ ] **Task 20 — `components/Pagination.jsx` + `AuditCell.jsx` + qolgan `lib`/`hooks` toastlari** (~8) · namespace `common`/`pagination`. Maxsus: pagination `{{count}} ta` → `common.count` plural; `lib/download.js`/`api.js` toastlari (`Tayyorlanmoqda...`, `Yuklab olishda xato...`, `Sessiya muddati tugadi...`, `Server xatosi`) → `errors.*`. **Eslatma:** bu fayllar React komponenti emas — `import i18n from '../i18n'; i18n.t('errors.session')` ishlating (`useTranslation` o'rniga). **Commit.**

---

# PHASE C — Yakuniy tekshiruv

### Task 21: Qoldiq matn va to'liq tekshiruv

- [ ] **Step 1: Qoldiq o'zbekcha matn qidirish**

Run:
```bash
cd frontend && rg -n "Saqlash|Bekor qilish|O'chirish|Tahrirlash|Yuklanmoqda|Topilmadi|Hozircha|tanlang|kiriting|majburiy" src/pages src/components src/App.jsx
```
Expected: faqat `t('...')` kalit chaqiruvlari yoki izohlar; hardcoded JSX matni **qolmasligi** kerak (print shablonidan tashqari — Sales). Topilsa — tegishli task ga qaytib almashtiring.

- [ ] **Step 2: Parity + format test + lint + build**

Run:
```bash
cd frontend && npm run i18n:check && npm run test:format && npm run lint && npm run build
```
Expected: Parity OK · format testlar PASS · lint 0 xato · build muvaffaqiyatli.

- [ ] **Step 3: E2E almashtirgich testi**

`frontend/e2e/i18n.spec.js`:
```js
import { test, expect } from '@playwright/test';

test('til almashtirgich — uz→ru→zh va saqlanish', async ({ page }) => {
  await page.goto('/');
  // dropdown ochish
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.getByText('Клиенты')).toBeVisible();        // nav ru ga o'tdi

  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.getByText('客户')).toBeVisible();            // nav zh ga o'tdi

  // saqlanishni tekshirish
  const lang = await page.evaluate(() => localStorage.getItem('erp_lang'));
  expect(lang).toBe('zh');
  await page.reload();
  await expect(page.getByText('客户')).toBeVisible();            // yangilashdan keyin zh qoldi
});
```
Run: `cd frontend && npx playwright test i18n.spec.js`
Expected: 1 passed. (Backend + DB ishlab turishi va `auth.setup` login qilishi kerak — mavjud config buni avtomatlashtiradi.)

- [ ] **Step 4: Qo'lda 3 tilli ko'zdan kechirish**

Har bir sahifani (Clients, Products, Sales, Payments, Contracts, Reports, Users, Audit, Interactions, Settings, Login) 3 tilda oching: menyu, forma label/placeholder, jadval `th`, toast (saqlash/o'chirish), bo'sh holat, sana (zh → yil oldinda), raqam guruhlash, ieroglif rendering. Rus ko'pligi: 1/2/5 mijoz to'g'ri (`1 клиент / 2 клиента / 5 клиентов`).

- [ ] **Step 5: Commit + spec/TEXNIK_VAZIFA yangilash**
```bash
cd frontend && git add e2e/i18n.spec.js && git commit -m "test(i18n): til almashtirgich E2E"
```
`TEXNIK_VAZIFA.md` "Joriy holat" ni yangilang (CLAUDE.md #23): i18n DONE, sana 2026-06-08.

- [ ] **Step 6: Branch yakuni**

`superpowers:finishing-a-development-branch` bilan: `main` ga merge yoki PR. Tarjima sifatini (ayniqsa ZH) foydalanuvchi ko'rigidan o'tkazish.

---

## Self-Review (reja muallifi tomonidan)

**1. Spec qamrovi:**
- Stack/kutubxona → Task 1 ✅ · Fayl tuzilmasi → barcha tasklar ✅ · format.js refactor → Task 2 ✅ · i18n init + lazy → Task 3 ✅ · namespace/reuse → konventsiya + Task 8+ ✅ · plural (ru) → Task 9/11/12/16 ✅ · LanguageSwitcher (globus dropdown) → Task 5 ✅ · Noto Sans SC → Task 3 (lazy) + Task 6 (stack) ✅ · localStorage persistence → Task 3 detector ✅ · sana/raqam locale → Task 2 + Step 5 sweep ✅ · hujjatlar o'zbekcha → Task 11 print carve-out ✅ · glossariy → Phase B protsedura + Task 8 ✅ · tekshiruv (lint/build/parity/E2E/sweep) → Task 21 ✅.
- **Gap yo'q.**

**2. Placeholder skani:** Phase A va Task 8 to'liq kod bilan. Tasks 9–20 — qasddan templated repeat (Login = to'liq shablon, har task aniq namespace + inventar kategoriyalari + maxsus plural/interpolatsiya kalitlari bilan); 755 satrli matnni takrorlash amaliy emas, lekin har sahifaning aniq ko'lami ko'rsatilgan. ✅

**3. Tip/nom muvofiqligi:** `setFormatLocale`/`getFormatLocale` (Task 2) ↔ i18n/index.js (Task 3) mos. `LANGS` (Task 3 eksport) ↔ LanguageSwitcher (Task 5) mos. `erp_lang` localStorage kaliti hamma joyda bir xil. JSON kalit yo'llari (`nav.*`,`titles.*`,`dashboard.*`,`common.*`,`units.*`,`login.*`) Task 3/6/8 da izchil. ✅
