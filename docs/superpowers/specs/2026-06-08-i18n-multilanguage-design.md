# Dizayn: Ko'p tillilik (i18n) — UZ / RU / ZH

**Sana:** 2026-06-08 · **Holat:** Tasdiqlandi (implementatsiyaga tayyor) · **Branch:** `main`

---

## 1. Maqsad

ERP dasturining butun **xodimlar interfeysini** uchta tilda taqdim etish: O'zbek (`uz`, joriy/boshlang'ich), Rus (`ru`), Soddalashtirilgan Xitoy (`zh`). Yuqorida til almashtirgich — har bir foydalanuvchi o'ziga qulay tilni tanlaydi, tanlov qurilmada saqlanadi.

### Ko'lam (qarorlar)

| Savol | Qaror |
|---|---|
| Qayerda kerak | Butun UI (menyu, tugmalar, sahifalar, jadvallar, toast/validatsiya). |
| Hujjatlar | **Hozircha o'zbekcha qoladi** (PDF/Word/Excel eksport + ekrandagi print shabloni). Alohida keyingi bosqich. |
| Tarjimani kim qiladi | Claude UZ→RU→ZH qiladi; foydalanuvchi keyin ko'rib tasdiqlaydi (ayniqsa ZH atamalar). |
| Joriy etish | Barcha sahifalar bir bosqichda (tezlik uchun), lekin tekshiriladigan tartibda. |
| Kutubxona | **react-i18next** (+ i18next yadro, resources-to-backend lazy-load, browser-languagedetector). |
| Almashtirgich ko'rinishi | Globus dropdown: `🌐 O'zbek ▾` → bayroqli ro'yxat (🇺🇿 O'zbek ✓ / 🇷🇺 Русский / 🇨🇳 中文), TopHeader'da mavzu tugmasi yonida. |

### Ko'lam tashqarisida (kelajak bosqichlari)
- Hujjat/print shablonlarini tarjima qilish (Puppeteer/docxtemplater + Sales print bloki).
- Til tanlovini backend `User` yozuviga saqlash (hozir localStorage yetarli — autentifikatsiya hali to'liq emas).

---

## 2. Topilgan ko'lam (inventarizatsiya, 2026-06-08)

Jami **755 ta** matn (har fayldagi takrorlar bilan). `common` namespace orqali unikal kalitlar ≈ **400-450**.

| Fayl | Matn | Fayl | Matn |
|---|---|---|---|
| Clients.jsx | 127 | Users.jsx | 44 |
| Reports.jsx | 127 | App.jsx (shell+dashboard) | 42 |
| Contracts.jsx | 95 | Interactions.jsx | 40 |
| Sales.jsx | 94 | components/* | 36 |
| Products.jsx | 45 | Payments.jsx | 31 |
| Settings.jsx | 29 | Audit.jsx | 28 |
| Login.jsx | 12 | hooks/lib/context | 5 |

- **103 ta** interpolatsiyali matn (`${total} ta mijoz`, `№${number}`).
- **22 ta** ko'plik (plural) holati.

---

## 3. Arxitektura

### 3.1 Fayl tuzilmasi
```
frontend/src/
  i18n/
    index.js              # i18next init (lazy + languagedetector)
    locales/
      uz.json             # manba (ekstraksiya qilingan o'zbekcha)
      ru.json             # rus tarjimasi
      zh.json             # xitoy tarjimasi (Simplified)
  components/
    LanguageSwitcher.jsx  # globus dropdown
  lib/format.js           # qayta yozilgan: Intl, aktiv tilga moslashadi
  main.jsx                # `import './i18n'` qo'shiladi
  index.css               # Noto Sans SC font stack (@theme)
```

### 3.2 `i18n/index.js` (init)
- `resourcesToBackend((lng) => import('./locales/' + lng + '.json'))` — Vite har tilni alohida chunk qiladi.
- `uz` — boshlang'ich bundle bilan statik resurs sifatida qo'shiladi (birinchi paintда flash bo'lmasin); `ru`/`zh` lazy.
- `LanguageDetector`: `order: ['localStorage','navigator']`, `caches: ['localStorage']`, `lookupLocalStorage: 'erp_lang'`.
- `fallbackLng: 'uz'`, `supportedLngs: ['uz','ru','zh']`, `interpolation.escapeValue: false`, `react.useSuspense: false`.
- Til o'zgarganda `document.documentElement.lang = lng` o'rnatiladi.

### 3.3 Namespace / kalit struktura (yagona JSON, nested)
`common` (qayta ishlatiladigan: Saqlash, Bekor, O'chirish, Tahrirlash, Yopish, Topilmadi, Yuklanmoqda…, Barchasi, Qarzdorlar, Haqdorlar, Yangi, Kim/Qachon), `nav`, `dashboard`, `clients`, `products`, `sales`, `payments`, `contracts`, `reports`, `users`, `audit`, `interactions`, `settings`, `login`, `units` (dona/kg/m²/m³/so'm), `validation`, `calendar` (oylar, hafta kunlari, davr presetlari).

### 3.4 `lib/format.js` refactor (raqam/sana — bitta nuqta)
- BCP-47 map: `uz→uz-UZ`, `ru→ru-RU`, `zh→zh-CN`.
- Modul darajasidagi `tag` o'zgaruvchisi; `i18n.on('languageChanged', …)` da yangilanadi.
- `Intl.NumberFormat`/`Intl.DateTimeFormat` per-locale **keshlanadi** (list render tezligi uchun).
- `fmt`, `fmtOrDash`, `fmtDate`, `fmtDateTime` imzosi o'zgarmaydi → sahifalar tegilmaydi.
- Natija: `uz/ru → 12.03.2026`, `zh → 2026/03/12`; guruhlash ham locale bo'yicha (`zh` vergul, `ru/uz` bo'sh joy).
- Qo'shimcha: App.jsx, Clients.jsx, Payments.jsx, Users.jsx, Audit.jsx, Settings.jsx ichidagi inline `toLocaleDateString('uz-UZ'/'ru-RU')` chaqiruvlari `fmtDate`/`fmtDateTime` ga yo'naltiriladi (hech narsa hardcoded qolmasin).

### 3.5 Ko'plik (plural)
react-i18next CLDR (`Intl.PluralRules`) orqali kalit suffikslari: `ru` → `_one`/`_few`/`_many`/`_other`; `uz` → `_one`/`_other`; `zh` → faqat `_other`. `t('clients.count', { count })` chaqiruvi to'g'ri shaklni tanlaydi.

### 3.6 `LanguageSwitcher.jsx` (globus dropdown)
- Ko'rinish: `🌐 <joriy til nomi> ▾`; bosilganda ro'yxat — 🇺🇿 O'zbek / 🇷🇺 Русский / 🇨🇳 中文, aktivda ✓.
- TopHeader'da mavzu (🌙) tugmasi yonida.
- Tanlovda: `i18n.changeLanguage(lng)` → localStorage (`erp_lang`) avtomatik + `document.documentElement.lang`.
- Tashqariga bosilganda yopiladi (mavjud dropdown patternlaridan foydalanish).

### 3.7 Xitoy shrifti (Tailwind v4)
- `index.css` `@theme` da `--font-sans` ga `'Noto Sans SC'` fallback qo'shiladi (lotin/kiril matn o'zgarmaydi — CJK gliflar shu shriftdan keladi).
- `@fontsource/noto-sans-sc` yoki `unicode-range` subset — faqat CJK belgilar kerak bo'lganda yuklanadi (to'liq font og'ir).

---

## 4. Tarjima QILINMAYDIGAN (qasddan)
- **DB ma'lumotlari:** mijoz/mahsulot/sotuvchi nomlari, shartnoma/spets raqamlari, izohlar, artikullar.
- **Valyuta kodlari:** UZS, USD, so'm.
- **Hujjat/print shablonlari:** o'zbekcha qoladi (yuqorida).

> Eslatma: domen yorliqlari (QQS, STIR/INN, MFO) — *yorliq* sifatida tarjima qilinadi (QQS→НДС→增值税), lekin *kod/qiymat* o'zgarmaydi. Tarjima ko'rigida aniqlashtiriladi.

---

## 5. Tarjima jarayoni va glossariy
Claude UZ→RU→ZH qiladi. Xitoycha ERP atamalari uchun boshlang'ich glossariy (ko'rikdan o'tkaziladi):

| Uzbek | Русский | 中文 |
|---|---|---|
| Yuk xati (nakladnoy) | Накладная | 货运单 |
| Tushum (to'lov) | Платёж / Поступление | 收款 |
| Qarz / Qarzdorlik | Задолженность | 应收账款 |
| Spetsifikatsiya | Спецификация | 规格明细 |
| Shartnoma | Договор | 合同 |
| QQS | НДС | 增值税 |
| Mijoz | Клиент | 客户 |
| Mahsulot | Товар | 产品 |
| Sotuvchi | Продавец | 销售员 |

---

## 6. Implementatsiya bosqichlari

### A — Infratuzilma
1. `npm i i18next react-i18next i18next-resources-to-backend i18next-browser-languagedetector @fontsource/noto-sans-sc`
2. `i18n/index.js` + bo'sh `locales/{uz,ru,zh}.json` skelet.
3. `main.jsx` ga `import './i18n'`.
4. `lib/format.js` refactor (Intl, locale-aware, keshli).
5. `LanguageSwitcher.jsx` + TopHeader'ga ulash.
6. `index.css` font stack.
7. **Tekshiruv:** bir-ikki kalit bilan almashtirgich ishlashini ko'rish.

### B — Ekstraksiya + tarjima (parallel workflow)
- 14 faylda hardcoded matn → `t('namespace.key')`; o'zbekcha qiymat `uz.json` ga.
- Har sahifaga 1 agent, **umumiy kalit lug'ati** (`common`, `units`, `validation`) ga qarshi — takrorni `common` ga yo'naltirish.
- `ru.json` + `zh.json` tarjimalari (glossariyga rioya).
- Plural kalitlari (`_one/_few/_many/_other`) ru uchun to'g'ri to'ldiriladi.

### C — Tekshiruv
- `cd frontend && npm run dev` → 3 tilni **har sahifada** ko'rish (menyu, formalar, jadval, toast, bo'sh holatlar, sana/raqam format).
- `npm run lint` → 0 xato.
- `npm run build` → muvaffaqiyatli.
- Tarjima qoldiqlari (o'zbekcha qolib ketgan) yo'qligini tekshirish.

---

## 7. Xavflar
- **Tarjima sifati (ZH):** ERP atamalari noto'g'ri bo'lishi mumkin → glossariy + foydalanuvchi ko'rigi majburiy.
- **Qoldiq hardcoded matn:** ekstraksiya 100% bo'lmasligi → C bosqichida har sahifani 3 tilda ko'zdan kechirish; ESLint/grep bilan o'zbekcha harflar (`'`, `g'`, `o'`) qoldig'ini qidirish.
- **Format re-render:** faqat `useTranslation` ishlatadigan komponentlar til o'zgarganда re-render bo'ladi — har sahifa endi `t()` ishlatadi, demak hammasi re-render bo'ladi va `fmt()` yangi locale'ni oladi.
- **Font og'irligi (ZH):** to'liq Noto Sans SC katta → subset/unicode-range bilan faqat kerakli glif yuklanadi.

---

## 8. Muvaffaqiyat mezoni
- TopHeader'da globus dropdown; UZ/RU/ZH almashadi, qayta yuklashda saqlanadi.
- Har sahifadagi barcha UI matni tanlangan tilda (DB ma'lumotlari va hujjatlardan tashqari).
- Rus ko'pligi to'g'ri (1 клиент / 2 клиента / 5 клиентов).
- Sana/raqam tanlangan tilga mos (zh → yil oldinda).
- Xitoy ierogliflari to'g'ri ko'rinadi.
- `lint` va `build` o'tadi.
