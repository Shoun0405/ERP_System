# ERP Tizim — Texnik Vazifa va Ish Jurnali

> **Maqsad:** SQLite → PostgreSQL ko'chirish, 5–20 concurrent user uchun arxitektura,
> frontend barqarorligi. Har sessiyada bu fayl yangilanadi — davom etishdan oldin o'qi.

---

## Joriy holat (oxirgi yangilanish: 2026-06-02)

**To'liq audit o'tkazildi (2026-06-02)** — fayl oxiridagi "🔬 DIAGNOSTIK HISOBOT" bo'limiga qarang.
3 ta CRITICAL, 6 ta HIGH topildi.

**Bajarildi (2026-06-02):** C-1 (JWT secret), C-3 (GET RBAC), H-3 (login rate-limit), M-1 (test bypass
qattiqlashtirish), H-7 (test crash tuzatildi). Test suite: **50/50 o'tdi**. Tafsilotlar Bosqich 14 va 17 da.

**Bajarildi (2026-06-02, 2-tur):** H-4 (in-memory token revocation blocklist) + Playwright E2E
autentifikatsiya integratsiyasi (storageState pattern). Backend **53/53**, E2E **4/4** (barqaror).

**Keyingi qadam:** Bosqich 15 (ombor + C-2 moliyaviy butunlik) → Bosqich 16 (audit UI + Decimal + hisobot).

**Bosqich 1–13 HAMMASI BAJARILDI. Bosqich 14 (JWT) — C-1/C-3/H-3/M-1/H-4 BAJARILDI (CSRF ixtiyoriy qoldi).**

Bosqich 14c da bajarildi: `routes/sales.js` — `specId` qabul qiladi, `contractId` Spec dan avtomatik; GET da `contract.number`, `spec.number` included; `Sales.jsx` to'liq qayta yozildi — modal o'rniga `useInlineForm` accordion; cascade (mijoz→shartnoma→spets); spets tanlanganda mahsulotlar prefill; jadvalda "Shartnoma №" va "Spets №" ustunlari.

Bosqich 14b da bajarildi: `Specification` va `SpecProduct` yangi modellari qo'shildi; `Contract` modeli kengaytirildi (`numericPart`, `yearPart`, `notes`, `status`, `specCounter`, `updatedAt`); `Sale.specId` optional qo'shildi; `backend/lib/vat.js` — QQS hisoblash; `routes/contracts.js` to'liq qayta yozildi (pagination + aggregate SQL); `routes/specs.js` yangi (CRUD + transaction); `routes/export.js` yangi (PDF 2 sahifa, Excel 2 sheet); `exceljs` + `pdfkit` o'rnatildi; `frontend/src/hooks/useInlineForm.js`; `frontend/src/lib/vat.js`; `frontend/src/pages/Contracts.jsx` to'liq yangi UI (inline form, expand specs, 3-dot menu, PDF/Excel yuklab olish); `App.jsx` — Shartnomalar route va sidebar; backfill script.

**Keyingi qadam:** Bosqich 14 (JWT Authentication) — login sahifasi, token, middleware.

---

## Bosqichlar va holat

### Bosqich 1 — PostgreSQL + Migration + Connection Pooling
**Holat: DONE ✅**

- [x] `schema.prisma` → `provider = "postgresql"`
- [x] `backend/.env` → `DATABASE_URL` PostgreSQL ga + `?connection_limit=20&pool_timeout=30`
- [x] Migration yaratilgan va apply qilingan (`prisma db push`)
- [x] `sqlite3` package o'chirildi
- [x] `backend/prisma.js` — shared PrismaClient instance (logging bilan)

---

### Bosqich 2 — Schema: Indekslar + Unique Constraints + SaleProduct→Product + Setting.updatedAt
**Holat: DONE ✅**

- [x] `Client.inn` → `@unique`
- [x] `Product.article` → `@unique`
- [x] `Contract` → `@@unique([number, clientId])`
- [x] `Sale` → `@@index([clientId, date])`, `@@index([contractId])`
- [x] `SaleProduct` → `product Product @relation(...)` + `@@index([saleId])`, `@@index([productId])`
- [x] `Payment` → `@@index([clientId, date])`, `@@index([contractId])`
- [x] `Interaction` → `@@index([clientId])`, `@@index([nextDate])`
- [x] `Setting.updatedAt DateTime @updatedAt` qo'shildi
- [x] `Product.saleProducts SaleProduct[]` qo'shildi
- [x] `prisma generate` qayta ishlatildi

---

### Bosqich 3 — Route Splitting
**Holat: DONE ✅**

`backend/server.js` 492 qator → 15 qator. Barcha routelar ajratildi:

- [x] `backend/routes/clients.js`
- [x] `backend/routes/products.js`
- [x] `backend/routes/contracts.js`
- [x] `backend/routes/sales.js`
- [x] `backend/routes/payments.js`
- [x] `backend/routes/interactions.js`
- [x] `backend/routes/dashboard.js`
- [x] `backend/routes/settings.js`

---

### Bosqich 4 — Dashboard N+1 → SQL Aggregation
**Holat: DONE ✅**

- [x] `prisma.sale.aggregate` — jami savdo summasi
- [x] `prisma.payment.aggregate` — jami to'lov summasi
- [x] `prisma.$queryRaw` — top 5 qarzdor SQL da (`HAVING debt > 0`)
- [x] `prisma.$queryRaw` — oylik savdo `TO_CHAR + GROUP BY` bilan
- [x] Barcha so'rovlar `Promise.all` da parallel bajariladi

---

### Bosqich 5 — Sale Transaction + Zod Validatsiya
**Holat: DONE ✅**

- [x] `zod` o'rnatildi (`npm install zod`)
- [x] `saleSchema` + `saleProductSchema` (`routes/sales.js` da)
- [x] Sale yaratish `prisma.$transaction` ichida
- [x] `createMany` bilan SaleProduct lar bitta query da

---

### Bosqich 6 — Frontend Refactor
**Holat: DONE ✅**

- [x] `frontend/.env` — `VITE_API_URL=http://localhost:3001`
- [x] `frontend/.env.production` — `VITE_API_URL=http://SERVER_IP:3001`
- [x] `frontend/src/lib/api.js` — axios instance + error interceptor + `API` export
- [x] `App.jsx` — `const API` o'chirildi, `import { API } from './lib/api'`
- [x] `Clients.jsx`, `Sales.jsx`, `Payments.jsx`, `Products.jsx`, `Settings.jsx` — hammasi yangilandi
- [x] Dashboard polling: `setInterval(fetchDashboard, 30_000)` + cleanup

---

### Bosqich 7 — Import.js Idempotent + TEXNIK_VAZIFA.md
**Holat: DONE ✅**

- [x] `import.js` — barcha `.create()` → `.upsert()` ga o'zgartirildi
- [x] `import.js` — `require('./prisma')` shared instance ishlatadi
- [x] `Setting.updatedAt` — Bosqich 2 da bajarildi
- [x] `TEXNIK_VAZIFA.md` yangilandi

---

## Muhim arxitektura qarorlari (o'zgartirma)

| Qaror | Sabab |
|-------|-------|
| PostgreSQL (SQLite emas) | Concurrent write xatolari, file locking |
| `connection_limit=20&pool_timeout=30` URL da | 5-20 user — har biri connection ochadi |
| `prisma.js` shared instance | Barcha routelar bitta pool ishlatadi |
| `$transaction` sale create da | Yarim yaratilgan sale xavfi yo'q |
| SQL SUM dashboard da | 1000+ sub-query muammosi yo'q |
| Zod validatsiya | Manfiy narx, NaN, noto'g'ri UUID kirishidan himoya |
| Route splitting | Har fayl mustaqil — debugging oson |
| `VITE_API_URL` env | Deploy da IP manuyal o'zgartirmaslik uchun |
| `upsert` import da | Script ikkinchi marta ishlatilsa duplicate xatosi yo'q |

---

## Texnik muhit

| Parametr | Qiymat |
|----------|--------|
| Backend port | 3001 |
| Frontend port | 5173 |
| DB | PostgreSQL `erp_db` @ localhost:5432 |
| DB user | `postgres` / `postgres` |
| Node | CommonJS (backend), ESM (frontend) |
| ORM | Prisma 6 |
| Framework | Express 5, React 19, Vite, Tailwind v4 |

---

## Ishga tushirish

```bash
# Backend
cd backend && node server.js

# Frontend
cd frontend && npm run dev

# Ma'lumotlarni ko'chirish (SQLite dan)
cd backend && node import.js

# Prisma schema o'zgarsa
cd backend && npx prisma db push
cd backend && npx prisma generate
```

## Production deploy uchun

1. `frontend/.env.production` da `SERVER_IP` ni haqiqiy IP ga o'zgart
2. `backend/.env` da `DATABASE_URL` ni production PostgreSQL ga o'zgartir
3. `cd frontend && npm run build` — `dist/` papkasi nginx/caddy orqali serve qilinadi
4. `cd backend && node server.js` — PM2 yoki systemd bilan ishlatish tavsiya etiladi

---

## Tahlil — joriy holat (2026-05-04)

7 bosqich bajarilgan, lekin kodda **noto'g'ri yoki yarim qilingan ishlar** topildi.
Bu muammolar performance, xavfsizlik va kelajakdagi rivojlanishga to'sqinlik qiladi.

### Noto'g'ri qilingan ishlar — REPORT

| № | Joy | Muammo | Oqibat | Og'irlik |
|---|-----|--------|--------|----------|
| 1 | `routes/clients.js` GET `/` | `include: { sales, payments }` — barcha mijozlar uchun BARCHA savdo va to'lov yuklanadi, JS da `reduce` qiladi | 100 mijoz × 1000 savdo = 100k qator har so'rovda. SQL `GROUP BY` kerak (`dashboard.js dagi topDebtors` shabloni) | **KRITIK** |
| 2 | `frontend/src/lib/api.js` | Konfiguratsiyalangan axios instance eksport, **lekin hech qaerda ishlatilmaydi** — sahifalar `axios.get(\`${API}/api/...\`)` qiladi | Error interceptor faollashmaydi, har sahifa `err.response?.data?.error` ni qo'lda yozadi. **Bosqich 6 yarim qilingan** | **KRITIK** |
| 3 | `routes/products.js` PUT `/bulk-price` | `Promise.all(updates.map(prisma.product.update))` — atomic emas | 200 mahsulotning yarmi update bo'lib turganda xato chiqsa — ma'lumot nomuvofiq qoladi. `$transaction` kerak | KATTA |
| 4 | `backend/prisma/dev.db` | SQLite davridan qolgan, repository da hali ham bor (`git rm` qilinmagan, `.gitignore` da yo'q) | Repo hajmi shishadi, eski ma'lumot bilan adashish mumkin | O'rta |
| 5 | `import.js` payments | `contractId: p.contractId || ''` — bo'sh string FK | Backup da contractId yo'q to'lov bo'lsa, import yiqiladi (FK constraint) | KATTA |
| 6 | `server.js` CORS | `app.use(cors())` — origin oq ro'yxati yo'q | Tarmoqdagi har qanday brauzer API ga kira oladi | O'rta |
| 7 | `server.js` | Graceful shutdown yo'q (`SIGINT`/`SIGTERM` da `prisma.$disconnect()` chaqirilmaydi) | PM2 restart paytida pool ochiq qoladi, connection leak | O'rta |
| 8 | Backend route lar | Markazlashgan error middleware yo'q — har joyda `try/catch` + `res.status(500).json({ error: e.message })` | Prisma stack trace, schema nomi mijozga oqib chiqadi (xavfsizlik) + kod takrorlanadi | KATTA |
| 9 | `routes/sales.js` Zod | `transportNum: z.string().optional()` — keyin `transportNum || ''` bilan override qilinadi | Mantiq buzuq: optional bo'lsa null saqlasin yoki Zod `.default('')` qilsin | Kichik |
| 10 | `routes/sales.js` Zod | `priceCbm: z.number().nonnegative()` — 0 narxda savdo o'tadi | Bepul yuk xati biznes mantig'iga zid. `positive()` bo'lishi kerak | Kichik |
| 11 | Zod validatsiya | Faqat `sales.js` da. `clients`, `products`, `payments`, `contracts`, `interactions`, `settings` da yo'q | Manfiy summa, NaN, juda uzun string, noto'g'ri UUID — har joyda kirib qoladi | KATTA |
| 12 | `routes/contracts.js` | PUT, DELETE yo'q | UI dan shartnomani o'zgartirib/o'chirib bo'lmaydi | O'rta |
| 13 | `routes/interactions.js` | PUT, DELETE yo'q. Frontend `pages/Interactions.jsx` ham yo'q | Backend route bor, lekin foydalanish yo'q — yarim feature | O'rta |
| 14 | Pagination | Hech bir list endpointda yo'q | 1000+ qator bo'lganda butun jadval har safar yuklanadi (sekin + RAM) | KATTA |
| 15 | `prisma.js` log | `NODE_ENV === 'development'` — odatda dev da bu o'zgaruvchi sozlanmagan | Real dev rejimida ham faqat `['error']` log bo'ladi | Kichik |
| 16 | `Settings` schema `updatedAt` | Qo'shilgan, lekin frontend da ko'rsatilmaydi | Audit qiymati behuda | Kichik |
| 17 | `Sales.jsx` detail modal | `p.productId.slice(0, 8)...` — UUID bo'lagini chiqaradi | Foydalanuvchi mahsulot artikulini ko'rmaydi (UX bug) | O'rta |
| 18 | `App.jsx` Dashboard polling | `setInterval(30000)` tab ko'rinmagan paytda ham ishlaydi | Bekor server zo'riqishi (ko'p user bo'lsa kuchayadi) | Kichik |
| 19 | `frontend/package.json` | `lucide-react: ^1.14.0` — bu mavjud emas (haqiqiy: `0.x`) | npm o'zi qaysi versiyani o'rnatgani aniqsiz, brittle | Kichik |
| 20 | `import.js` upsert | `update: {}` — qayta ishlatilganda yangilangan ma'lumot e'tiborga olinmaydi | Idempotent, lekin "yangilash" ishlamaydi. Fayldagi izoh aldamchi | Kichik |

---

## Bosqich 8 — Performance: aggregation, pagination, transaction
**Holat: DONE ✅**

- [x] `routes/clients.js` GET — `$queryRaw` SUM aggregation (N+1 butunlay yo'qotildi)
- [x] Barcha list endpointlarga pagination: `?page=1&limit=50&search=...&sortBy=...&sortDir=...` (clients, sales, payments, products)
- [x] Frontend list pagelarda `Pagination.jsx` kontroli + debounced search (300ms setTimeout)
- [x] `routes/products.js` PUT `/bulk-price` — `prisma.$transaction` ichida
- [x] Express `compression` middleware — JSON response 70-80% kichrayadi
- [x] **Frontend axios refaktori tugallandi** — barcha sahifalar `api.get('/api/...')` ishlatadi (interceptor faol)
- [x] Dashboard polling — `document.hidden` paytida `clearInterval`, `visibilitychange` da qaytarsin
- [ ] `@tanstack/react-virtual` — pagination bilan 50 qator ko'rsatilganda kerak emas; kelajakda limit katta bo'lsa qo'shiladi



---

## Bosqich 9 — Validation & Security
**Holat: DONE ✅**

- [x] `routes/_schemas.js` — markazlashgan Zod schemalar: `clientSchema`, `productSchema`, `bulkPriceSchema`, `paymentSchema`, `contractSchema`, `interactionSchema`, `settingSchema`, `saleSchema`
- [x] Barcha POST/PUT routelarda `schema.parse(req.body)` — manfiy summa, NaN, noto'g'ri UUID, uzun string kirib qolmaydi
- [x] `sales.js` Zod tuzatildi: `priceCbm: z.number().positive()`, `transportNum: z.string().nullable().default('')`
- [x] CORS — `process.env.CORS_ORIGIN` oq ro'yxati; `.env` ga `CORS_ORIGIN=http://localhost:5173` qo'shildi
- [x] `helmet` middleware — security headers
- [x] `express-rate-limit` — `/api/*` ga 200 req/min
- [x] Markazlashgan error middleware (server.js oxirida) — ZodError → 400, boshqa → 500 `'Server xatosi'`
- [x] Barcha routelarda `res.status(500).json({ error: e.message })` → `next(e)` — Prisma stack oqmaydi
- [ ] JWT auth — kelajakda (local tarmoq, hozircha shoshilinch emas)



---

## Bosqich 10 — UX: Toast, Print, Filters, Bug fixes
**Holat: DONE ✅**

- [x] `react-hot-toast` — barcha `alert()` o'chirildi (Sales, Clients, Payments, Products, Settings). `lib/api.js` interceptor ham toast ko'rsatadi
- [x] `Sales.jsx` detail modal bug fix — `GET /:id` da `products: { include: { product: true } }`, frontend `p.product.article` chiqaradi
- [x] "Yuk xatini chop etish" — `react-to-print` + A4 shablon (kompaniya nomi, mijoz, mahsulotlar jadvali, imzo joyi)
- [x] Sales + Payments — `?from=&to=&clientId=` sana va mijoz filtri (backend + frontend)
- [x] Clients — XLSX export (joriy search/sort bo'yicha `limit=1000`)
- [x] `pages/Interactions.jsx` yaratildi — to'liq CRM tarix UI (list, filter, add modal). Sidebar ga "Muloqotlar" qo'shildi
- [x] `Settings.jsx` — "Oxirgi yangilanish: {updatedAt}" header da. Backend `updatedAt` ni response ga qo'shadi
- [ ] Optimistik update — pagination bilan murakkab, kelajakda (hozir refetch tezkor)
- [ ] `Button` komponenti — kelajakda (hozir 5 joyda bor, lekin shakllar har xil)



## Bosqich 11 — Production hardening
**Holat: DONE ✅**

- [x] `.gitignore` (root) yaratildi: `prisma/dev.db`, `**/.env`, `node_modules`, `dist`, `*.log`, `pg-backup/`
- [ ] `git rm --cached backend/prisma/dev.db` — foydalanuvchi tasdig'i kerak (destructive)
- [x] `server.js` — graceful shutdown (`SIGINT`/`SIGTERM` → `prisma.$disconnect()`)
- [x] `/api/health` — `routes/health.js`, DB ping `SELECT 1`, `{ status, uptime, db }` response
- [x] `ecosystem.config.js` — PM2 config (instances=1, max_memory=512M, log rotation)
- [x] `prisma.js` log tuzatildi: `NODE_ENV !== 'production'` (oldin `=== 'development'` edi)
- [x] `morgan` o'rnatildi — production da `app.use(morgan('combined'))`
- [x] `scripts/backup.ps1` — `pg_dump`, 14 kunlik retention, Task Scheduler uchun
- [x] `Payment.contractId String?` (optional) — schema + `prisma db push`
- [x] `import.js` tuzatildi: `contractId: p.contractId || null`; `update: {}` → haqiqiy maydonlar; `--dry-run` flagi
- [x] Frontend serve — Variant A: `express.static('../frontend/dist')` + SPA fallback. `VITE_API_URL=''` (same-origin). Bitta port (3001)
- [x] `lucide-react@1.14.0` — o'rnatilgan va ishlaydi (1.x versiyalari mavjud)



---

## Bosqich 12 — Tests & Monitoring
**Holat: DONE ✅**

- [x] `backend/app.js` ajratildi — Express app testlar uchun import qilinadi (`server.js` faqat listen)
- [x] `vitest` + `supertest` — `backend/tests/`: health, clients, products, sales, payments (20+ test case)
  - `global-setup.mjs` — `erp_test_db` ga `prisma db push --force-reset` (bir marta)
  - `env-setup.mjs` — har test workerda `DATABASE_URL` test DB ga
  - `helpers.mjs` — `makeClient`, `makeContract`, `makeProduct` yordamchi funksiyalar
  - `npm test` → `vitest run`
- [x] Playwright e2e — `frontend/e2e/flow.spec.js` (3 ta flow):
  - Yangi mijoz listda ko'rinishi
  - Savdo yaratish → savdolar listda ko'rinishi
  - To'lov qo'shish → tushumlar listda ko'rinishi
  - `playwright.config.js` — webServer avtomatik ishga tushuradi (backend + frontend)
  - `npm run test:e2e`
- [x] `scripts/uptime-check.js` — har 5 daqiqada `/api/health` ping, xato bo'lsa Telegram xabar
- [x] Sentry — `SENTRY_DSN` `.env` da bo'lsa avtomatik faollashadi (placeholder)



---

## Bosqich 13 — Yarim feature larni yopish va DRY
**Holat: DONE ✅**

- [x] `backend/routes/_schemas.js` — `paymentSchema.contractId` → `z.string().uuid().nullable().optional()` (DB bilan moslik)
- [x] `backend/routes/payments.js` POST — `contractId: contractId || null` (FK uchun null, qoida #17)
- [x] `frontend/src/pages/Payments.jsx` — shartnoma ixtiyoriy (label, required olib tashlandi, submit guard o'chirildi)
- [x] `backend/routes/contracts.js` — PUT `/:id` + DELETE `/:id` (linked bo'lsa Prisma P2003 → 409 "Bog'langan savdo yoki to'lov mavjud")
- [x] `backend/routes/interactions.js` — to'liq qayta yozildi: GET pagination (`page`, `limit`, `search`, `clientId`), PUT `/:id`, DELETE `/:id`
- [x] `frontend/src/pages/Interactions.jsx` — server-side pagination, debounced search, edit modal ('add'|'edit'), delete confirm modal
- [x] `frontend/src/pages/Clients.jsx` — expand panelda shartnoma CRUD UI: `+ Yangi`, Edit, Delete tugmalari; ContractModal + delContractId confirm modal; `useModalKeys` ikki marta (client + contract modal uchun)
- [x] `frontend/src/lib/format.js` — `fmt`, `fmtOrDash`, `fmtDate` umumiy helperlar; `App.jsx`, `Clients.jsx`, `Sales.jsx`, `Payments.jsx`, `Products.jsx` dan local `fmt`/`fmtN` o'chirildi
- [x] `backend/tests/contracts.test.mjs` — 4 ta test: POST, PUT, DELETE linked→409, DELETE clean→200
- [x] `backend/tests/interactions.test.mjs` — 4 ta test: POST, GET pagination metadata, PUT, DELETE

---

# 🔬 DIAGNOSTIK HISOBOT — To'liq Audit (2026-06-02)

> Audit qamrovi: butun backend (`app.js`, `prisma.js`, 15 ta route, 2 middleware, 2 lib),
> Prisma sxema, frontend yadrosi (`App.jsx`, `lib/api.js`, kontekst, helperlar), test infratuzilmasi.
> Metodologiya: statik kod tahlili + `npm test` ishga tushirildi.
>
> **Test natijasi:** `8 passed (9) fayl · 43 passed (46) test · 1 error`.
> Sabab: `tests/global-setup.mjs:20` da `prisma db push --force-reset` Prisma 6 ning
> "dangerous AI action" / destructive-reset konsentini ishga tushiradi va bitta worker
> kutilmaganda yiqiladi → 3 ta test bajarilmay qoladi. Bu **infra muammosi**, kod regressiyasi emas
> (pastda H-7 ga qarang).

## Og'irlik bo'yicha xulosa

| Og'irlik | Soni | ID lar |
|----------|------|--------|
| 🔴 CRITICAL | 3 | C-1, C-2, C-3 |
| 🟠 HIGH | 6 | H-1 … H-6 |
| 🟡 MEDIUM | 8 | M-1 … M-8 |
| 🟢 LOW | 6 | L-1 … L-6 |

---

## 🔴 CRITICAL

### C-1 — Hardcoded JWT fallback secret (avtentifikatsiyani chetlab o'tish)
- **Joy:** `backend/middleware/auth.js:3`, `backend/routes/auth.js:8`
- **Kod:** `const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_erp_system_123';`
- **Ta'sir:** Agar `JWT_SECRET` env o'rnatilmagan bo'lsa (yoki `.env` deploy da unutilsa), serverlarda **ma'lum, ommaviy** sekret ishlatiladi. Hujumchi ushbu sekret bilan istalgan `role: 'admin'` token imzolab, butun tizimni egallaydi. Fallback qiymati endi shu repozitoriyada ham yozilgan.
- **Yechim:**
  1. Fallback ni o'chirish. Start paytida tekshirish: `if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET majburiy'); process.exit(1); }` — `app.js` yuqorisida.
  2. `JWT_SECRET` ni `auth.js` va `auth.js`(route) da bitta modul orqali (`lib/jwt.js`) eksport qilish, ikki joyda takrorlamaslik.
  3. Kuchli random sekret generatsiya: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### C-2 — Server savdo qatori summasiga ishonadi (moliyaviy butunlik buzilishi)
- **Joy:** `backend/routes/sales.js:108` (`totalAmount = products.reduce((s,p)=>s+p.rowAmount,0)`), sxema `_schemas.js:78-87`
- **Ta'sir:** `saleProductSchema` mijozdan kelgan `rowAmount`, `priceCbm`, `totalCbm` larni **qayta hisoblamaydi** — to'g'ridan-to'g'ri saqlaydi va jami summa shulardan yig'iladi. Buzg'unchi (yoki buzuq frontend) `rowAmount: 1` yuborib, real qiymati 100 mln so'mlik yuk xatini 1 so'mga rasmiylashtirishi mumkin. Qarzdorlik (`debt = ΣtotalAmount − Σpayment`) butun tizim bo'ylab buziladi. Taqqoslang: `routes/specs.js:53` spetsifikatsiyada summani **server tomonda** `calcRowTotal()` bilan qayta hisoblaydi — savdoda bu yo'q.
- **Yechim:** Savdo POST/PUT da `rowAmount` ni server tomonda mahsulot narxi × miqdoridan qayta hisoblash (yoki kamida `priceCbm × totalCbm` bilan tekshirib, mos kelmasa 400). `rowAmount`/`totalAmount` ni mijoz kiritadigan maydon emas, hosila qiymat sifatida ko'rish.

### C-3 — GET (o'qish) endpointlarida RBAC yo'q — gorizontal/modulaviy ma'lumot oqishi
- **Joy:** `clients.js:18`, `products.js:7`, `sales.js:7,81`, `payments.js:7`, `contracts.js:11,139`, `interactions.js:6`, `export.js` (barcha GET) — hech birida `requirePermission(..., 'read')` yo'q. Faqat `reports.js:8` o'qishni tekshiradi.
- **Ta'sir:** RBAC modeli `permissions[module].read` ni va'da qiladi (`users.js:9-18` DEFAULT_PERMISSIONS), frontend sidebarni shunga qarab yashiradi (`App.jsx:52-56`), **lekin backend o'qishni umuman tekshirmaydi**. `reports.read=false`, `settings.read=false` qilingan "seller" ham `/api/sales`, `/api/clients`, `/api/export/...` ga to'g'ridan-to'g'ri so'rov yuborib hamma narsani ko'radi. Bu RBAC ni faqat kosmetik qiladi.
- **Yechim:** Har bir list/detail GET ga `requirePermission('<module>', 'read')` qo'shish. `export.js` ni tegishli modul (`contracts`/`sales`) read huquqiga bog'lash. Frontend yashirish — chuqurlikdagi himoya, yagona himoya emas.

---

## 🟠 HIGH

### H-1 — Konfiguratsiyalanadigan QQS stavkasi soxta (hech qayerda ishlatilmaydi)
- **Joy:** `_schemas.js:75` (`vatRate` validatsiya qilinadi va saqlanadi), `backend/lib/vat.js:1` va `frontend/src/lib/vat.js` (`VAT_RATE = 0.12` qattiq yozilgan)
- **Ta'sir:** Sozlamalarda QQS stavkasi o'zgartirilsa ham, spetsifikatsiya QQS hisobi (`calcVat`) doim 12% ishlatadi. Stavka o'zgarganda (masalan 12%→15%) eski hujjatlar noto'g'ri, foydalanuvchi sozlama ta'sir qilyapti deb o'ylaydi. Soliq xatosi.
- **Yechim:** `calcVat(total, rate)` parametrlashtirilsin; `routes/specs.js` POST/PUT da sozlamadan `vatRate` o'qib uzatsin. Frontend `lib/vat.js` ni sozlama bilan sinxronlash yoki backend hisobiga tayanish.

### H-2 — Shartnoma raqamlashda race condition (atomik emas)
- **Joy:** `routes/contracts.js:191-202` — `aggregate(_max numericPart)` keyin alohida `create`, **transaction yoki lock yo'q**
- **Ta'sir:** Ikki foydalanuvchi bir vaqtda shartnoma yaratsa, ikkalasi ham bir xil `MAX+1` o'qiydi → bir xil raqam. `@@unique([number, clientId])` faqat **bitta mijoz** ichida himoya qiladi; turli mijozlarga bir xil shartnoma raqami beriladi (audit/hujjat chalkashligi). Spec raqamlashda ham xuddi shu (`specs.js:46`), lekin u transaction ichida — baribir READ COMMITTED da ikki tx bir xil MAX o'qishi mumkin va `P2002` **404/500 sifatida ushlanmaydi** (`specs.js:89`).
- **Yechim:** PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext('contract:'||year))`) transaction boshida, yoki alohida `Counter` jadvali `UPDATE ... RETURNING` bilan. Spec POST da `P2002` ni 409 ga aylantirib retry.

### H-3 — Brute-force: login alohida rate-limit qilinmagan
- **Joy:** `app.js:37` — global `/api` uchun 200 req/min. `routes/auth.js` login uchun qattiqroq limit yo'q.
- **Ta'sir:** Bitta IP 200 parol/min sinashi mumkin; lockout yoki exponential backoff yo'q. Bcrypt biroz sekinlashtiradi, lekin zaif parollar uchun yetarli emas.
- **Yechim:** `/api/auth/login` ga alohida `rateLimit({ windowMs: 15*60_000, max: 10, skipSuccessfulRequests: true })`. Ixtiyoriy: muvaffaqiyatsiz urinishlar hisobi + vaqtinchalik bloklash.

### H-4 — JWT ichidagi `permissions` eskiradi, token bekor qilish/yangilash yo'q
- **Joy:** `routes/auth.js:37-41` (`permissions` token ichiga joylanadi), `auth.js:25-27` (token dekod qilinadi, DB tekshirilmaydi)
- **Ta'sir:** Admin foydalanuvchi huquqlarini kamaytirsa yoki hisobni `isActive=false` qilsa, mavjud token **24 soat** amal qiladi — yangi huquqlar/bloklash kuchga kirmaydi. Token o'g'irlansa, bekor qilishning yo'li yo'q (refresh/blacklist yo'q).
- **Yechim:** Qisqa muddatli access token (15 min) + refresh token rotatsiyasi; yoki har so'rovda `isActive` va `permissions` ni DB dan o'qish (kichik tizim uchun maqbul); yoki `tokenVersion` ustuni + parol/role o'zgarganda inkrement.

### H-5 — Hisobot endpointlarida cheklanmagan to'liq jadval yuklash (RAM/DoS)
- **Joy:** `reports.js:74-82` (`client-by-contracts` — mijozning barcha sale+payment), `reports.js:166-184` (`client-statement`), `reports.js:241` (`debtors` — butun mijozlar bo'ylab), `export.js:367` (`sales/pdf` — `ids` cheklanmagan)
- **Ta'sir:** Yillar davomida ma'lumot to'planganda bitta mijozda 10k+ sale bo'lishi mumkin — hammasi xotiraga yuklanadi, JS da saralanadi. Bir nechta bunday so'rov serverni RAM bo'yicha bo'g'adi.
- **Yechim:** Hisobotlarni SQL `GROUP BY`/oynaviy funksiyalarga ko'chirish (running balance `SUM() OVER (ORDER BY date)`); export `ids` uzunligini cheklash (masalan ≤ 500); sahifalash yoki sana oralig'i majburiy qilish.

### H-6 — `xlsx@0.18.5` (SheetJS) ma'lum zaifliklari
- **Joy:** `frontend/package.json` → `"xlsx": "^0.18.5"`, ishlatilishi `App.jsx:11,311`
- **Ta'sir:** Bu versiyada Prototype Pollution (CVE-2023-30533) va ReDoS (CVE-2024-22363) bor. Hozir faqat o'z generatsiya qilingan ma'lumotni eksport qiladi (ishonchsiz fayl o'qilmaydi), shuning uchun amaliy xavf past — lekin foydalanuvchi import funksiyasi qo'shilsa kritik bo'ladi.
- **Yechim:** Rasmiy SheetJS CDN build (`https://cdn.sheetjs.com/...`) ga o'tish yoki `exceljs` (backend da allaqachon bor) bilan eksport qilish. npm `xlsx` ni olib tashlash.

---

## 🟡 MEDIUM

### M-1 — Test rejimida header orqali auth chetlab o'tish
- **Joy:** `auth.js:6-9`, `rbac.js:8-9,27-28` — `NODE_ENV==='test' && header['x-bypass-auth']!=='false'` → to'liq admin.
- **Ta'sir:** Agar prod da xato bilan `NODE_ENV=test` qo'yilsa, har qanday so'rov admin huquqi oladi. Konfiguratsiya xatosi xavfli.
- **Yechim:** Bypass ni alohida `process.env.TEST_AUTH_BYPASS==='1'` flagiga bog'lash; ishlab chiqarish build da bu kod yo'lini umuman o'chirish (test helperда token yaratish afzal).

### M-2 — Sxema `Float` moliyaviy summalar uchun (yaxlitlash xatosi)
- **Joy:** `schema.prisma` — `totalAmount`, `rowAmount`, `amount`, `totalValue`, `priceCbm` … barchasi `Float`
- **Ta'sir:** IEEE-754 float pul uchun — yig'indilar va QQS hisobida tiyin darajasida xatolik to'planadi (`0.1+0.2` muammosi). Katta UZS summalarda ko'rinmas, lekin solishtirishlar (`debt = 0`) noto'g'ri ishlashi mumkin.
- **Yechim:** Pul maydonlarini `Decimal @db.Decimal(18,2)` ga o'tkazish (Prisma `Decimal`). Migratsiya + frontend `Number()` o'rniga string-decimal ishlash.

### M-3 — Spec POST da `P2002` ushlanmaydi
- **Joy:** `routes/specs.js:89` — `catch(e){ next(e) }`, P2002 maxsus ishlanmaydi
- **Ta'sir:** Race yoki qayta raqam holatida foydalanuvchi "Server xatosi" 500 oladi (409 o'rniga). H-2 bilan bog'liq.
- **Yechim:** `if (e.code==='P2002') return res.status(409)...`.

### M-4 — `bulk-delete` / `bulk-factura` da Zod yo'q va massiv hajmi cheklanmagan
- **Joy:** `sales.js:293-321` — `ids` faqat `Array.isArray` bilan tekshiriladi
- **Ta'sir:** UUID formati tekshirilmaydi; juda katta massiv (`100k id`) DoS yoki sekin so'rov. `status` faqat ikki qiymat — bu yaxshi.
- **Yechim:** `z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })`.

### M-5 — `helmet()` standart CSP — SPA inline uslublariga ta'sir + CSP sozlanmagan
- **Joy:** `app.js:25`
- **Ta'sir:** Standart helmet CSP ko'p inline-style ishlatuvchi UI ni buzishi yoki aksincha himoya yetarli emasligi mumkin; hozircha aniq CSP siyosati yo'q. Same-origin serve (Variant A) da muhim.
- **Yechim:** Aniq `contentSecurityPolicy` direktivalari yozish (`script-src 'self'`, `style-src 'self' 'unsafe-inline'` zaruratga ko'ra), `crossOriginEmbedderPolicy` ni eksport (PDF) bilan moslab sozlash.

### M-6 — `Promise.all` to'g'ri, lekin ba'zi tekshiruvlar transaction tashqarisida (TOCTOU)
- **Joy:** `payments.js:57-68` — shartnoma-mijoz mosligi `create` dan oldin alohida so'rovda (transaction tashqarisida)
- **Ta'sir:** Tekshiruv va yozuv orasida shartnoma o'chirilsa/o'zgarsa nomuvofiqlik. Ta'sir past (shartnoma kamdan-kam o'chiriladi), lekin savdoda (`sales.js`) bu to'g'ri transaction ichida — nomuvofiq uslub.
- **Yechim:** To'lov yaratishni ham `$transaction` ichida tekshirish bilan birga bajarish.

### M-7 — Audit log butun `payload` ni saqlaydi (PII/maxfiylik o'sishi)
- **Joy:** `lib/audit.js:12-21`, chaqiruvlar `sales.js:179`, `clients.js:110` (`data` to'liq) …
- **Ta'sir:** Mijoz to'liq ma'lumotlari (INN, telefon, manzil) audit `payload` (Json) ga nusxalanadi — chegarasiz o'sadi, GDPR/maxfiylik bo'yicha "o'chirish huquqi" ni murakkablashtiradi. Parol loglanmaydi (yaxshi).
- **Yechim:** Faqat o'zgargan maydon nomlari yoki diff saqlash; yirik payloadlarni kesish; retention siyosati (eski auditlarni arxivlash).

### M-8 — Reports/export sanasi UTC vs mahalliy chegarasi
- **Joy:** `reports.js:17,283,335,368` — `toDate.setHours(23,59,59,999)` server mahalliy vaqtida; `sales.js:30` `new Date(to+'T23:59:59')` — TZ ko'rsatilmagan
- **Ta'sir:** Server TZ va foydalanuvchi TZ farq qilsa, kun chegarasidagi tranzaksiyalar hisobotga noto'g'ri tushadi (UZS biznesi UTC+5).
- **Yechim:** Sana chegaralarini aniq vaqt zonasida hisoblash (`Asia/Tashkent`) yoki barcha sanalarni UTC da saqlab, so'rovda TZ ofsetini hisobga olish.

---

## 🟢 LOW

- **L-1 — `dev.db` hali repo da (TV #4, #11 da qayd, hali bajarilmagan):** `git rm --cached backend/prisma/dev.db` foydalanuvchi tasdig'i bilan.
- **L-2 — Health endpoint `uptime` ni oshkor qiladi (`health.js:7`):** kichik ma'lumot oqishi; muhim emas, lekin prod da minimallashtirish mumkin.
- **L-3 — `console.error(err)` markaziy middleware da (`app.js:66`):** stack faqat serverga yoziladi (yaxshi), lekin tarkibiy log (pino/winston) + Sentry ga yo'naltirish afzal; PII stacklarini filtrlash.
- **L-4 — ZodError `issues` mijozga qaytariladi (`app.js:68`):** maydon nomlari/struktura oqadi — kichik info leak; foydalanuvchiga do'stona, lekin ichki maydon nomlarini yashirish mumkin.
- **L-5 — `products-top` `limit` cheklanmagan (`reports.js:280`):** `parseInt` natijasi cheksiz; `Math.min(100, ...)` qo'shish.
- **L-6 — Frontend marshrut himoyasi faqat kosmetik (`App.jsx:620-628`):** ruxsatsiz route Dashboard ga tushadi, lekin bu UX; haqiqiy himoya C-3 (backend) da.

---

## Yaxshi bajarilgan jihatlar (regress qilmaslik kerak)

- ✅ N+1 yo'q: `clients.js`, `dashboard.js`, `contracts.js` — pre-aggregatsiya subquery bilan Kartezian ko'paytmadan qochilgan.
- ✅ Raw SQL **to'liq parametrlashtirilgan** — `Prisma.sql` tagli shablonlar, `Prisma.raw` faqat oq ro'yxatdagi ustun/yo'nalishda (`clients.js:8-16,69`). SQL injection topilmadi.
- ✅ Savdo/spec yozuvlari `$transaction` ichida atomik; spec summasi server tomonda hisoblanadi.
- ✅ Pagination barcha list endpointlarda (`page/limit/search`, max 200).
- ✅ Markazlashgan error middleware + shared Prisma + graceful shutdown.
- ✅ Parollar `bcrypt` (10 round); token `httpOnly`+`sameSite=lax`+prod da `secure`; CORS allowlist + credentials.

---

# 🗺 KEYINGI BOSQICHLAR — Revised Roadmap

## Bosqich 14 — JWT Authentication HARDENING (qisman bajarilgan → to'ldirish)
**Holat: PARTIAL → TODO (hardening)**

Asosiy JWT login allaqachon bor (`47b2ad3`). Quyidagilar **xavfsizlik bo'shliqlari** sifatida qoldi (C-1, C-3, H-3, H-4, M-1):

- [x] **Secret majburiyligi (C-1):** `backend/lib/jwt.js` — yagona manba (`signToken`/`verifyToken`); `JWT_SECRET` yo'q yoki <32 belgi bo'lsa `console.error`+`process.exit(1)`. Zaif default (`'secret_jwt_erp_system_123'`) `middleware/auth.js` va `routes/auth.js` dan o'chirildi. `.env` ga 96-belgilik sekret + `JWT_TTL`; commit qilinadigan `backend/.env.example` qo'shildi. Tekshirildi: yo'q/zaif → exit 1, kuchli → sign/verify OK.
- [x] **GET RBAC (C-3):** `requirePermission('<module>','read')` qo'shildi — clients, products, sales (2 GET), payments, contracts (3 GET), specs, interactions GET lariga + `export.js` (6 ta export route). `settings` GET (umumiy konfiguratsiya, formalar uchun kerak) va `dashboard` (bosh sahifa) ataylab ochiq qoldirildi. Yangi `tests/rbac.test.mjs` (4 test): read:false→403, read:true→200, tokensiz→401.
- [x] **Login rate-limit (H-3):** `app.js` — `/api/auth/login` ga `max:10 / 15min`, `skipSuccessfulRequests:true`, do'stona xato xabari.
- [x] **Token tirikligi (H-4) — in-memory revocation blocklist:** `backend/lib/revocation.js` — process-ichi `Set` (`revokeUser`/`allowUser`/`isRevoked`). `middleware/auth.js` token tekshirgandan keyin DB SIZ `isRevoked(id)` ni tekshiradi → bekor qilingan bo'lsa 401. `routes/users.js`: DELETE da `revokeUser`; PUT da `isActive:false` yoki rol/huquq/parol o'zgarsa `revokeUser` (eskirgan token majburiy yangilanadi), qayta faollashtirilganda `allowUser`. Yangi `tests/revocation.test.mjs` (3 test): faol→200, faolsizlantirilgach eski token→401, qayta faollashtirilgach→200. Cheklov (kod izohida): process-ga xos (PM2 instances=1), restart da tozalanadi — to'liq yechim Variant A (DB `RefreshToken` + qisqa access token), kelajakda kerak bo'lsa.
- [x] **Test bypass qattiqlashtirish (M-1):** Bypass endi `NODE_ENV==='test' && TEST_AUTH_BYPASS==='1'` ikkalasini talab qiladi (`middleware/auth.js`, `rbac.js`). `tests/env-setup.mjs` da flag yoqildi. Prod da xato bilan `NODE_ENV=test` qo'yilsa ham bypass ishlamaydi.
- [ ] **CSRF (M-5 bilan):** sameSite=lax yetarli emas deb topilsa, mutatsion so'rovlarga `X-CSRF-Token` (double-submit cookie). *(KEYINGI QADAM.)*

**API o'zgarishlari:** `POST /api/auth/refresh`, `POST /api/auth/logout` (refresh revoke). **Frontend:** 401 da avtomatik `/refresh` urinish (interceptor), keyin login.

---

## Bosqich 15 — Inventar (ombor) + Race-condition Lock + Moliyaviy butunlik
**Holat: TODO**

Hozir **ombor qoldig'i umuman yo'q** — savdo qancha bo'lsa ham mahsulot cheksiz "sotiladi". ERP uchun kritik bo'shliq. Shu bosqichda C-2 va H-2 ham yopiladi.

- [ ] **Sxema — inventar:**
  ```prisma
  model Product { ... stockPieces Int @default(0) /* yoki Decimal */ }
  model StockMovement {
    id String @id @default(uuid())
    productId String
    product Product @relation(fields:[productId], references:[id])
    delta Float        // + kirim, − chiqim
    reason String      // "sale" | "purchase" | "adjustment"
    refId String?      // saleId yoki hujjat
    createdAt DateTime @default(now())
    @@index([productId, createdAt])
  }
  ```
- [ ] **Savdo butunligi (C-2):** `sales.js` POST/PUT da har qator `rowAmount` ni server tomonda mahsulot narxi × miqdoridan **qayta hisoblash**; mijozdan kelganini e'tiborsiz qoldirish yoki tekshirib mos kelmasa 400.
- [ ] **Stok yetishmasligi + lock:** Savdo `$transaction` ichida `SELECT ... FOR UPDATE` (`$queryRaw` yoki `tx.$executeRaw`) bilan mahsulot qatorini bloklab, `stockPieces >= totalPieces` tekshirish; yetmasa 409 "Ombor yetarli emas". `StockMovement` yozuvi + `stockPieces` dekrement bir tranzaksiyada.
- [ ] **Raqamlash race (H-2):** Shartnoma/spec raqamlashda `pg_advisory_xact_lock(...)` yoki `Counter` jadvali; spec POST da `P2002`→409 retry.
- [ ] **API:** `GET /api/products/:id/stock` (harakatlar tarixi), `POST /api/stock/adjustment` (admin qo'lda tuzatish).
- [ ] **UI:** Mahsulot ro'yxatida "Qoldiq" ustuni (kam bo'lsa qizil); savdo formasida real-time qoldiq ko'rsatish; ombor harakatlari jurnali sahifasi.
- [ ] **Testlar:** parallel ikki savdo bir mahsulotni sotganda biri 409 (lock); manfiy/buzuq `rowAmount` 400.

---

## Bosqich 16 — Audit Trail UI + Enterprise Hisobot + Decimal pul
**Holat: TODO**

`AuditLog` jadvali yoziladi, lekin **ko'rish UI yo'q** (yarim feature). Pul `Float` (M-2). Hisobotlar to'liq jadval yuklaydi (H-5).

- [ ] **Audit UI:** `GET /api/audit?entityType=&userId=&from=&to=&page=` (admin-only, pagination, filtr). Frontend: filtrlanadigan jadval, diff ko'rinishi. Payload diff-only saqlash (M-7) + retention (eski auditlarni arxivlash/o'chirish skripti).
- [ ] **Decimal migratsiya (M-2):** Pul maydonlarini `Decimal(18,2)` ga; backend Prisma `Decimal`, frontend string-decimal formatlash (`fmt` ni moslash).
- [ ] **QQS konfiguratsiyasi (H-1):** `calcVat(total, rate)`; spec hisoblashda sozlama `vatRate` ishlatish; frontend bilan sinxron.
- [ ] **Hisobot optimizatsiyasi (H-5):** `client-statement` running-balance ni SQL `SUM() OVER (ORDER BY date)` ga ko'chirish; export `ids` ≤500 cheklash; sana oralig'i majburiy.
- [ ] **Yangi hisobotlar:** Davr bo'yicha P&L (savdo − xarid), QQS hisoboti (soliq deklaratsiyasi uchun), ombor qoldig'i qiymati, sotuvchi bo'yicha komissiya/oborot.
- [ ] **Batch invoice eksport:** tanlangan bir nechta shartnoma/savdoni bitta ZIP (PDF/Excel) ga; `xlsx@0.18.5` ni `exceljs` ga almashtirish (H-6).
- [ ] **Testlar:** audit yozuvi har mutatsiyada yaratiladi; Decimal yaxlitlash (0.1+0.2) testi.

---

## Bosqich 17 — Test infratuzilmasi tuzatish + qamrov
**Holat: TODO (tezkor)**

- [x] **H-7 / test crash:** `global-setup.mjs` — `prisma db push --force-reset` Prisma 6 destructive guard ni ishga tushirardi → worker crash. `--force-reset` olib tashlandi (test fayllari `cleanAll()` bilan o'zlari tozalanadi), endi faqat `db push --skip-generate` sxemani sinxronlaydi. Natija: **50/50 test o'tdi (10 fayl), crash yo'q** (oldin 43/46 + crash).
- [ ] **Qamrov kengaytirish:** validatsiya 400 (manfiy summa, buzuq UUID), FK 409 (linked delete), RBAC 403 (read/write huquq yo'q), auth 401 (token yo'q/yaroqsiz) — har modul uchun. Hozir asosan happy-path.
- [ ] **C-2 regress testi:** buzuq `rowAmount` bilan savdo → server qayta hisoblaydi yoki rad etadi.
- [x] **Playwright E2E auth fix:** auth endi majburiy bo'lgani uchun e2e so'rovlari 401 olardi. `e2e/auth.setup.js` (setup loyihasi) — `scripts/seed-e2e-user.js` bilan dev bazaga e2e admin qo'shadi, login qilib `storageState` (cookie) saqlaydi; `playwright.config.js` da `setup` loyihasi + `chromium` uchun `storageState` (page va request ikkalasi avtorizatsiyalanadi). `flow.spec.js` CommonJS→ESM (type:module), Savdo formasiga `data-testid` lar (`sale-form`, `sale-client`, `sale-contract`, `sale-nakladnoy`, `sale-seller`, `row-product`, `row-amount`) + barqaror selektorlar + afterAll to'liq tozalash. Natija: **4/4 o'tdi (barqaror, retries=0)**.
- [ ] CI (GitHub Actions / local) — `npm test` + `npm run lint` + `npm run build` har push da.

---

## Audit yakuni — ustuvorlik tartibi

1. **C-1 (JWT secret)** — bir qatorlik o'zgarish, eng katta xavf. Darhol.
2. **C-3 (GET RBAC)** — RBAC ni haqiqiy qilish.
3. **C-2 + Bosqich 15** — moliyaviy butunlik + ombor.
4. **H-3, H-4, M-1** — auth hardening (Bosqich 14).
5. **H-1, M-2, H-5** — moliyaviy aniqlik + hisobot (Bosqich 16).
6. **Bosqich 17** — test ishonchliligi.
