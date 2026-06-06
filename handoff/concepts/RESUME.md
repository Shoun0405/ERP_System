# UX/UI redizayn — DAVOM ETTIRISH NUQTASI (resume)

> Oxirgi sessiya: 2026-06-06. Holat: **6 konsepsiya renderlandi, foydalanuvchi yo'nalishni HALI tanlamadi.**
> Foydalanuvchi: "hozirga yetadi, shu branchga commit qil, qolganini keyin qilamiz."

## Maqsad
`handoff/ERP UX-UI Audit.html` (20 topilma, F-01…F-20) + `handoff/README.md` + `handoff/CLAUDE_CODE_PROMPT.md` asosida ERP frontend UX/UI ni yaxshilash.

## ⚠️ MUHIM CHEKLOV (xotira: `ui-bulk-migration-rejected`, `ui-design-show-options-first`)
- Avval (2026-06-06) yagona `PageShell` ga **5 sahifani birdan** ko'chirish ishi **bekor qilingan** — `ux-ui-development` branchi o'chirilgan. Sabab: bitta statik konsept asosida bulk migratsiya qilingan.
- Shuning uchun bu safar: **(1)** avval bir nechta **renderlangan** konsepsiya yonma-yon ko'rsatiladi → **(2)** foydalanuvchi tanlaydi → **(3)** faqat **bitta sahifa** (Mijozlar) tanlangan yo'nalishda qilinadi → **jonli** (npm run dev, light+dark) ko'rsatiladi → **(4)** tasdiqdan keyingina keyingi sahifa. **Bulk migratsiya QAYTA bo'lmasin.**

## Nima qilindi (bu sessiya)
9 agentli workflow (`erp-uxui-concepts`) ishga tushirildi:
- **Arxitektor** — Sales/Products/Payments/Contracts ni o'qib, yagona karkas qo'llab-quvvatlashi shart bo'lgan strukturaviy talablarni aniqladi (`_synthesis.json` → `understand`).
- **6 dizayner** — "Mijozlar (CRM)" sahifasini haqiqiy tema (index.css tokenlari, Inter, indigo) bilan to'liq, self-contained HTML qilib chizdi.
- **Frontend lead** + **PM** — feasibility baholash + 0–10 ball + sahifama-sahifa rollout reja (`_synthesis.json` → `feasibility`, `pm`).

Har konsepsiya Playwright bilan **light + dark** screenshot qilindi va 2 ta yonma-yon contact-sheet yasaldi. Foydalanuvchiga ko'rsatildi.

## 6 konsepsiya + PM ball
| # | Nom | Ball | Eslatma |
|---|-----|------|---------|
| **1** | **Tuzatilgan Hozirgi** | **9** | Eng past tavakkal. Karkas o'zgarmaydi; ~105 qotirilgan rang → token. Funksiya tegmaydi. |
| **3** | **Yumshoq Karta** (Stripe/havodor) | **8** | "Modern SaaS" didiga eng mos premium estetika. Jadval strukturasi saqlanadi. |
| **6** | **Premium Fintech (KPI-strip)** | **7** | Ro'yxat ustiga KPI (jami/qarz/kechikkan/yangi). Kechikkan uchun backend agregat kerak. |
| 5 | Toolbar + Chiplar (Airtable) | 5 | Filtr-chip + tab counter → yangi state + API. |
| 2 | Zich Pro Grid (Linear) | 4 | Eng yuqori tavakkal — butun jadval markup qayta yoziladi. |
| 4 | Ikki Panel (master-detail) | 3 | Faqat Mijozlarga mos; Savdolar/Shartnomalar oqimi bilan ziddiyat. |

**PM tavsiyasi:** **#1 ni baza** (rang higiyenasi) + ustiga **#3 vizual**. Keyin ixtiyoriy: Mijozlar/Tushumlar/Savdolarga **#6 KPI-strip**.
**Frontend lead:** #1, #3, #6 jadval strukturasini saqlaydi → qidiruv/sort/kaskad/pagination/ruxsat buzilmaydi. #2, #4 = eng katta regressiya xavfi.

## ✅ KEYINGI QADAM (resume qilganda)
1. **Foydalanuvchidan yo'nalishni so'ra** (1/3/6 yoki #1+#3 kombinatsiya). Tanlanmagan — bu birinchi ish.
2. Tanlangach: **faqat `frontend/src/pages/Clients.jsx`** ni shu yo'nalishda qil (funksiyaga tegmasdan — qidiruv/sort/debtFilter/expand→shartnoma CRUD/pagination/ruxsat saqlansin).
3. `npm run dev` → brauzerda Mijozlarni **light+dark** jonli ko'rsat (jonli tekshiruv uchun e2e: `node scripts/seed-user.js` yoki `node frontend/e2e` setup; login).
4. Foydalanuvchi tasdig'i (DARVOZA) → keyin tartib bo'yicha: **Mijozlar → Tushumlar → Shartnomalar → Mahsulotlar → Savdolar** (eng murakkab oxirida). Har biri orasida darvoza.

To'liq feasibility/PM/architecture matni: **`_synthesis.json`**.

## Fayllar (handoff/concepts/)
- `concept-1.html … concept-6.html` — to'liq, self-contained, renderlanadigan mockuplar (haqiqiy tema).
- `concept-N-light.png` / `concept-N-dark.png` — har konsepsiya to'liq screenshot.
- `contacts-light.png` / `contacts-dark.png` — 6 tasi yonma-yon (2×3).
- `labels.json` — konsepsiya raqami → nom.
- `_synthesis.json` — arxitektura talablari + feasibility + PM ranking/rollout (agentlar chiqishi).
- `render-concepts.mjs` — qayta render: `node handoff/concepts/render-concepts.mjs` (Playwright `frontend/node_modules` dan).

## Manbalar
- Audit: `handoff/ERP UX-UI Audit.html`
- Spetsifikatsiya: `handoff/README.md`, `handoff/CLAUDE_CODE_PROMPT.md`
- Tayyor (ishlatilmagan) komponentlar: `handoff/components/PageShell.jsx`, `StatusBadge.jsx`, `handoff/lib/format.js`, `handoff/phase2/*`
- Joriy tema tokenlari: `frontend/src/index.css`
