# ERP Tizim — Texnik Vazifa va Ish Jurnali

> **Maqsad:** SQLite → PostgreSQL ko'chirish, 5–20 concurrent user uchun arxitektura,
> frontend barqarorligi. Har sessiyada bu fayl yangilanadi — davom etishdan oldin o'qi.

---

## Joriy holat (oxirgi yangilanish: 2026-05-12)

**Bosqich 1–13 HAMMASI BAJARILDI.**

Bosqich 13 da bajarildi: `contracts.js` PUT/DELETE (linked bo'lsa 409); `interactions.js` PUT/DELETE + server-side pagination + search; `Interactions.jsx` edit/delete UI + debounced search; `Clients.jsx` shartnoma CRUD UI (expand panelda); `paymentSchema.contractId` optional qilindi (DB bilan moslik); `Payments.jsx` shartnoma ixtiyoriy; `frontend/src/lib/format.js` — `fmt`, `fmtOrDash`, `fmtDate` umumiy helperlar (barcha sahifalar import qiladi); `contracts.test.mjs` va `interactions.test.mjs` yozildi.

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

### Bosqich 8 uchun AI promti

> **Vazifa:** Performance refaktor — 1000 mijoz, 10000 savdo bo'lganda UI 1 soniyada javob bersin.
>
> **Boshlashdan oldin:**
> 1. `CLAUDE.md` "AI Coding Rules" ni o'qi (ayniqsa 1, 2, 4, 7, 12, 13).
> 2. `routes/dashboard.js` dagi `$queryRaw` + `topDebtors` shablonini ko'r — mijozlar listi shu uslubda yozilsin.
> 3. `frontend/src/lib/api.js` ni o'qi — `api` default export hali sahifalarda ishlatilmaydi (Bosqich 6 yarim qolgan).
>
> **Qilish tartibi (priority bo'yicha):**
> 1. **Eng oldin:** `routes/clients.js` GET `/` ni `$queryRaw` ga ko'chir. `include: sales/payments` butunlay olib tashlansin. Response: `[{ id, name, inn, ..., totalSales, totalPayments, debt }]`.
> 2. Pagination: server-side query parametrlari `?page=1&limit=50&search=&sortBy=&sortDir=`. Response shakli: `{ data, total, page, limit }`. **Avval** `clients`, `sales`, `payments`, `products` da. Search `Prisma.sql` template (SQL injection xavfsiz).
> 3. `routes/products.js` PUT `/bulk-price` — `prisma.$transaction(updates.map(...))`.
> 4. `server.js` ga `compression` middleware (`npm i compression`).
> 5. `lib/api.js` interceptor faollashishi uchun **barcha** sahifalarda `axios.get(\`${API}/api/...\`)` → `api.get('/api/...')`. `API` import faqat fayl yuklash kerak bo'lganda qoladi.
> 6. Frontend pagination control komponenti: `src/components/Pagination.jsx` (oldingi/keyingi + sahifa raqami). Search input `useDeferredValue` bilan.
> 7. Dashboard polling: `App.jsx` da `useEffect` ichida `document.visibilityState !== 'visible'` da interval to'xtasin, `visibilitychange` listener bilan qaytarsin.
> 8. **Eng oxirida:** `@tanstack/react-virtual` — faqat 1000+ qator kutiladigan listlar (Sales, Payments).
>
> **Tugaganda:** Yuqorida `[ ]` larni `[x]` ga o'zgartir, "Holat: DONE ✅" qil, "Joriy holat" sanasini yangila va qisqa "Bosqich 8 da nima bajarildi" satrini qo'sh.
>
> **Shoshilma:** Pagination — eng katta o'zgarish, har route va har page ga ta'sir qiladi. Bitta entityni to'liq tugat (backend + frontend), keyin keyingisiga o't.

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

### Bosqich 9 uchun AI promti

> **Vazifa:** Validatsiya va xavfsizlikni tugatish — backend hech qachon mijoz xatosida `e.message` qaytarmasin va manfiy/NaN/uzun string kira olmasin.
>
> **Boshlashdan oldin:**
> 1. `CLAUDE.md` "AI Coding Rules" 5, 6 qoidalarini o'qi.
> 2. `routes/sales.js` dagi mavjud Zod ishlatilishini namuna sifatida ko'r.
> 3. `backend/.env` ga `CORS_ORIGIN=http://localhost:5173` qo'shilsa kerak — tekshir.
>
> **Qilish tartibi:**
> 1. `backend/routes/_schemas.js` yarat — barcha Zod schema lar shu yerda. `clientSchema`, `productSchema`, `paymentSchema`, `contractSchema`, `interactionSchema`, `settingSchema`. Har biri POST + PUT (PUT da `.partial()` ishlatish mumkin).
> 2. `routes/sales.js` Zod ni shu fayldan import qilsin. **Tuzat:** `priceCbm: z.number().positive()` (nonneg emas), `transportNum: z.string().nullable().default('')` (`|| ''` override yo'q).
> 3. Har route POST/PUT da `schema.parse(req.body)` ishlatsin. ZodError bo'lsa `next(err)` (markaziy middleware ushlasin).
> 4. `server.js` ga **markazlashgan error middleware** (eng oxirida). ZodError → 400 + `{ error: 'Validatsiya xatosi', issues }`. Boshqa har qanday xato → 500 + `{ error: 'Server xatosi' }`. `console.error(err)` har doim.
> 5. `npm i helmet express-rate-limit` — `server.js` da:
>    - `app.use(helmet())`
>    - `app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173' }))`
>    - `app.use('/api', rateLimit({ windowMs: 60_000, max: 100 }))`
> 6. Routelardagi har bir `try/catch` da `res.status(500).json({ error: e.message })` ni o'chir — **`next(e)`** bilan almashtir. Bu eng katta diff, ehtiyot bo'lib qil.
> 7. JWT — bu bosqichda **qilma** (TODO ro'yxatda qoldir, lokal tarmoqda kechiktirish mumkin).
>
> **Tugaganda:** TEXNIK_VAZIFA.md da Bosqich 9 holatini DONE qil, "Tahlil" jadvalidagi 6, 8, 10, 11 raqamli muammolarni "Hal qilindi" izohi bilan belgila.

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

### Bosqich 10 uchun AI promti

> **Vazifa:** Foydalanuvchi tajribasini sayqallash. Bu bosqich **ko'rinadigan** o'zgarishlarni olib keladi — har birini brauzerda ko'r.
>
> **Boshlashdan oldin:**
> 1. `CLAUDE.md` "AI Coding Rules" 8, 9, 10, 14, 15 ni o'qi.
> 2. Bosqich 8 va 9 tugagan bo'lishi shart — UI usti pagination + toast bilan stabil.
> 3. `frontend/package.json` da `lucide-react` versiyasini tekshir (Bosqich 11 da tuzaladi, hozir mavjud versiyani buzma).
>
> **Qilish tartibi (foydalanuvchi qadr-qiymat tartibida):**
> 1. **Toast (eng birinchi).** `npm i react-hot-toast`. `App.jsx` da `<Toaster />`. Barcha `alert(...)` ni `toast.error(...)`/`toast.success(...)` ga almashtir (Sales, Clients, Payments, Products). `lib/api.js` interceptor da ham `toast.error` ishlatilsin.
> 2. **Bug fix — Sales detail modal.** `routes/sales.js` GET `/:id` da `products: { include: { product: true } }`. `Sales.jsx` modal da `p.productId.slice(0,8)` o'rniga `p.product.article` + `p.product.name`.
> 3. **Sana filtri.** `Sales.jsx`, `Payments.jsx` da "dan" / "gacha" date input + clientId select. Backend `GET /api/sales?from=&to=&clientId=` query parametrlarini qo'llasin.
> 4. **Print yuk xati.** `npm i react-to-print`. `Sales.jsx` detail modal ichida "Chop etish" tugma. A4 shablon: kompaniya nomi (Settings dan), mijoz, sana, mahsulotlar jadvali, jami summa, imzo joyi.
> 5. **Optimistik update.** Yangi mijoz/savdo qo'shilganda refetch o'rniga `setItems(prev => [created, ...prev])`. Xato bo'lsa rollback.
> 6. **`pages/Interactions.jsx` qarori.** Yo to'liq UI (CRM tarix sahifa, list + add modal), yo `routes/interactions.js` ni o'chirish. **Yarim feature qoldirma** (Rule 14).
> 7. **Settings.jsx** — "Oxirgi yangilanish: {fmt(updatedAt)}" header da.
> 8. **XLSX export Clients.** `npm i xlsx`. "Excel ga ko'chirish" tugma — joriy filter+sort bo'yicha.
> 9. **`Button` komponenti** — agar 5+ joyda `disabled={saving}` takrorlansa, shundagina chiqar (Rule 15: 3+ marta ko'rinmaguncha abstraktsiya yaratma; bu yerda 5+ shart, chunki Button — engil takrorlanish).
>
> **Tugaganda:** Brauzerda har bir flow ni qo'lda urib ko'r (mijoz qo'sh, savdo qo'sh, to'lov qo'sh, savdoni chop et, Excel ga ko'chir, sana filtri). TEXNIK_VAZIFA.md da Bosqich 10 ni DONE qil.

---

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

### Bosqich 11 uchun AI promti

> **Vazifa:** Tizim "men ishlayapman" dan "ofisda 24/7 ishlay oladi" holatiga o'tsin. Real foydalanuvchilar oldida xato qilmaslik — backup, restart, monitoring kerak.
>
> **Boshlashdan oldin:**
> 1. `CLAUDE.md` "AI Coding Rules" 16, 17, 19 ni o'qi.
> 2. **MUHIM:** `git rm --cached` kabi destruktiv buyruqdan oldin foydalanuvchidan ruxsat ol.
> 3. Server Windows mashinasida ishlaydimi yoki Linux da — foydalanuvchidan so'ra (PM2 vs systemd vs Task Scheduler tanloviga ta'sir qiladi).
>
> **Qilish tartibi:**
> 1. **`.gitignore` (root).** Yarat: `prisma/dev.db`, `**/.env`, `**/.env.production`, `node_modules`, `dist`, `*.log`, `pg-backup/`. **So'roq:** `git rm --cached backend/prisma/dev.db backend/.env frontend/.env*` ni foydalanuvchi tasdig'i bilan ishlat.
> 2. **Graceful shutdown.** `server.js` ga:
>    ```js
>    ['SIGINT','SIGTERM'].forEach(sig => process.on(sig, async () => {
>      await prisma.$disconnect(); process.exit(0);
>    }));
>    ```
> 3. **Health endpoint.** `routes/health.js` → `GET /api/health` → `await prisma.$queryRaw\`SELECT 1\`` muvaffaqiyatli bo'lsa `{ status: 'ok', uptime, db: 'up' }`.
> 4. **Logger.** `npm i pino pino-pretty morgan`. `server.js`:
>    - `app.use(morgan('combined'))` faqat `NODE_ENV === 'production'`.
>    - `prisma.js` da `NODE_ENV !== 'production'` (qoida 15-muammo).
> 5. **import.js tuzatish.**
>    - `payments` → `contractId: p.contractId || null`. Schema `Payment.contractId String?` (optional). `prisma db push` + `generate`.
>    - `upsert` larda `update: {}` o'rniga haqiqiy maydonlar (Rule 16). Yoki `--dry-run` flagi qo'sh: `if (process.argv.includes('--dry-run')) return console.log(...)`.
> 6. **PM2 / systemd.** `ecosystem.config.js` (PM2 uchun): name, script, instances=1, autorestart, max_memory_restart=512M, log fayl yo'llari.
> 7. **PostgreSQL backup.** `scripts/backup.ps1` (Windows) yoki `scripts/backup.sh` (Linux): `pg_dump erp_db > backup-YYYY-MM-DD.sql`, 14 kundan eski faylni o'chirish. Task Scheduler / cron bilan har kun 02:00.
> 8. **Frontend serve.** Tanlov:
>    - **Variant A (oson):** `server.js` ga `app.use(express.static('../frontend/dist'))` + SPA fallback. Bitta port (3001).
>    - **Variant B (to'g'ri):** Nginx/Caddy konfiguratsiya namunasi `docs/deploy.md` da.
>    Foydalanuvchi tanlasin.
> 9. **`lucide-react` versiyasi.** `frontend/package.json` da `^0.460.0` ga (yoki npm da `lucide-react@latest` versiyasini tekshirib, eng yaqinini qo'y). `npm install`.
>
> **Tugaganda:** Server qayta ishga tushir, `/api/health` ni urib ko'r, backup skriptini bir marta qo'lda ishlatib `.sql` fayl borligini tekshir. TEXNIK_VAZIFA.md da Bosqich 11 ni DONE qil.

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

### Bosqich 12 uchun AI promti

> **Vazifa:** Regression himoyasi va xatolarni real vaqtda kuzatish. Bosqich 8–11 tugab, tizim ofisda ishlayotgan bo'lsa, shu bosqich avtomatlashtirilgan to'r yaratadi.
>
> **Boshlashdan oldin:**
> 1. Bosqich 11 tugaganligi shart — health endpoint, graceful shutdown bo'lmasa monitoring keraksiz.
> 2. Foydalanuvchidan so'ra: bulutga (Sentry) yuborish maqbulmi yoki self-host (GlitchTip) kerakmi.
>
> **Qilish tartibi:**
> 1. **Backend smoke testlar.** `npm i -D vitest supertest`. `backend/tests/` papkasi:
>    - `tests/setup.js` — test DB ulanishi (`erp_test_db`), beforeAll/afterAll da migratsiya + tozalash.
>    - Har route uchun bitta test fayl: `clients.test.js`, `sales.test.js`... CRUD asosiy flow (POST → GET → PUT → DELETE), Zod validatsiya xatosi 400, mavjud emas 404.
>    - `package.json` script: `"test": "vitest run"`.
> 2. **Playwright e2e.** `npm i -D @playwright/test`. `frontend/e2e/`:
>    - `flow.spec.js` — 3 ta flow:
>      a) Yangi mijoz qo'shish → list da ko'rinishi.
>      b) Mahsulot tanlab savdo yaratish → debt yangilanishi.
>      c) To'lov qo'shish → debt kamayishi.
> 3. **Sentry / GlitchTip.**
>    - Backend: `@sentry/node` `server.js` da `requestHandler` + `errorHandler` (markaziy middleware oldida).
>    - Frontend: `@sentry/react` `main.jsx` da, `dsn` `.env` dan.
>    - Source map yuborish faqat production build da.
> 4. **Uptime monitor.** Ichki variant: `scripts/uptime-check.js` — `/api/health` ni har 5 daqiqada urib, xato bo'lsa Telegram bot orqali xabar (Telegram bot token + chat_id `.env` da).
>
> **Tugaganda:** `npm test` muvaffaqiyatli o'tsin, Playwright UI mode da har 3 flow yashil bo'lsin, Sentry dashboard da test xato ko'rinsin. TEXNIK_VAZIFA.md da Bosqich 12 DONE.

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
