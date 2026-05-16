# ERP Tizim — Texnik Vazifa va Ish Jurnali

> **Maqsad:** SQLite → PostgreSQL ko'chirish, 5–20 concurrent user uchun arxitektura,
> frontend barqarorligi. Har sessiyada bu fayl yangilanadi — davom etishdan oldin o'qi.

---

## Joriy holat (oxirgi yangilanish: 2026-05-16)

**Bosqich 1–13 HAMMASI BAJARILDI. Bosqich 14b (Shartnomalar) va 14c (Savdolar inline) BAJARILDI.**

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
