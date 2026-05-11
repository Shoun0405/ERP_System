# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Both servers must run simultaneously:

```bash
# Backend (port 3001)
cd backend && node server.js

# Frontend (port 5173)
cd frontend && npm run dev
```

```bash
# After editing prisma/schema.prisma
cd backend && npx prisma db push
cd backend && npx prisma generate

# Frontend lint
cd frontend && npm run lint

# Production build
cd frontend && npm run build

# Data migration from backup (idempotent — safe to re-run)
cd backend && node import.js
```

There is no test suite.

## Architecture

This is a full-stack ERP for textile/building materials trading, with Uzbek-language UI and UZS currency. The repo contains two independent Node projects:

- `backend/` — CommonJS, Express 5, Prisma 6, PostgreSQL
- `frontend/` — ESM, React 19, Vite, Tailwind CSS v4

### Backend

Entry point: `backend/server.js` — minimal (15 lines), only mounts routers.

Routes are split by entity in `backend/routes/`:

| File | Endpoints |
|---|---|
| `clients.js` | GET, POST, PUT /:id, DELETE /:id |
| `products.js` | GET, POST, PUT /bulk-price, PUT /:id, DELETE /:id |
| `contracts.js` | GET, POST |
| `sales.js` | GET, GET /:id, POST (transaction + Zod), DELETE /:id |
| `payments.js` | GET, POST, DELETE /:id |
| `interactions.js` | GET, POST |
| `dashboard.js` | GET — SQL aggregation, no N+1 |
| `settings.js` | GET, PUT |

Shared Prisma instance: `backend/prisma.js` — all routes `require('../prisma')`.

**Debt is never stored.** Always computed as `SUM(sale.totalAmount) - SUM(payment.amount)` — in SQL for dashboard (`$queryRaw`), in JS map for client list.

**Sale creation** uses `prisma.$transaction` — sale + saleProducts are atomic.

**Validation** uses Zod in `routes/sales.js`. Other routes do not yet have Zod (clients, payments, products).

**Settings** are a single-row JSON blob: `Setting` table with `id: 'global'`, entire config in the `data` TEXT column.

### Database

- Provider: PostgreSQL (`erp_db` @ localhost:5432)
- Connection: `backend/.env` → `DATABASE_URL` with `?connection_limit=20&pool_timeout=30`
- Schema: `backend/prisma/schema.prisma`

Key schema points:
- All PKs are UUIDs (`@default(uuid())`)
- `Client.inn` — `@unique`
- `Product.article` — `@unique`
- `Contract` — `@@unique([number, clientId])`
- `SaleProduct` → `Sale` has `onDelete: Cascade`
- `SaleProduct` → `Product` has explicit relation (`product Product @relation(...)`)
- `Payment.isFromExcel` — flag for import.js migrated records
- `Setting.updatedAt` — `@updatedAt`
- Indexes on all foreign keys and common filter fields

### Frontend (`frontend/src/`)

API base URL comes from env: `import.meta.env.VITE_API_URL` (set in `frontend/.env`).
Shared axios instance with error interceptor: `frontend/src/lib/api.js` — exports `API` (string) and default axios instance.

All pages import `{ API } from '../lib/api'` — never hardcode the URL.

The `Dashboard` component lives in `App.jsx` alongside `Sidebar` and `TopHeader` — not in `pages/`. Dashboard polls every 30 seconds (`setInterval`). All other pages are in `src/pages/`:

| File | Module |
|---|---|
| `Clients.jsx` | CRM — client list, search, debt display |
| `Products.jsx` | Product catalog with physical dimensions and multi-unit pricing (CBM/ton/sqm) |
| `Sales.jsx` | Sales orders (yuk xatlari / nakladnoy) with line items |
| `Payments.jsx` | Payment receipts (tushumlar), filtered by client |
| `Settings.jsx` | Company info and seller list management |

`src/hooks/useModalKeys.js` — shared hook that binds `Ctrl+Enter` (save) and `Escape` (close) for all modals.

### UI Conventions

- Numbers formatted with Russian locale: `Math.round(n).toLocaleString('ru-RU')` (the `fmt()` helper in `App.jsx`)
- Dark sidebar (`#09090b`), light content area (`#fafafa`)
- Tailwind CSS v4 is configured via `@tailwindcss/vite` plugin, not `postcss`
- Error handling: currently `alert()` in most pages — planned migration to toast notifications

## Known gaps (see TEXNIK_VAZIFA.md for full plan)

- No authentication — any user on the network has full access
- No pagination — all list endpoints return full table scans
- `alert()` still used in Sales, Clients, Payments, Products pages
- Zod validation only in `routes/sales.js`; other routes unvalidated
- `contracts.js` and `interactions.js` missing PUT/DELETE endpoints

---

## AI Coding Rules (har sessionda majburiy)

Bu loyihada kod yozayotganda AI quyidagi qoidalarga **har doim** rioya qilsin. Ular `TEXNIK_VAZIFA.md` Tahlil bo'limidagi 20 ta noto'g'ri ishdan kelib chiqqan — yana takrorlanmasligi uchun.

### 1. Database & Backend

1. **N+1 ni man qilish.** List endpointlarda `include: { sales, payments }` ishlatilmasin. Aggregate kerak bo'lsa `prisma.$queryRaw` + SQL `GROUP BY` (`routes/dashboard.js` shabloni).
2. **Bir nechta yozish — `$transaction`.** `Promise.all([prisma.x.update(...), ...])` atomic emas. 2+ tabel yoziladigan har bir joyda `prisma.$transaction([...])` yoki callback varianti.
3. **Shared Prisma.** Yangi route `new PrismaClient()` qilmasin — `require('../prisma')` orqali shared instance.
4. **Pagination — list endpoint majburiyligi.** GET `/` larda `?page&limit&search&sortBy` parametrlari qo'llab-quvvatlansin. Default `limit=50`, max `limit=200`. Response `{ data: [...], total: N, page, limit }` formatida.
5. **Zod barcha POST/PUT da.** `routes/_schemas.js` da markazlashtirilgan. Optional + default mantig'i ziddiyatsiz: `z.string().nullable().default('')` yoki `optional()` — ikkalasini birga ishlatib `|| ''` bilan override qilmaslik.
6. **Mijozga `e.message` qaytarmaslik.** Markazlashgan error middleware orqali `{ error: 'Server xatosi' }` (ichki log: `console.error`). Prisma stack mijozga oqmasin.

### 2. Frontend

7. **Faqat shared `api` instance.** `axios.get(\`${API}/api/...\`)` o'rniga `import api from '../lib/api'` + `api.get('/api/...')`. Error interceptor faqat shu yo'l bilan ishlaydi.
8. **`alert()` taqiqlangan.** Yangi kodda toast (`react-hot-toast` / `sonner`) ishlatilsin. Eskilarini ham migratsiya qilish kerak.
9. **`fmt()` raqamlar uchun.** Hech qachon `n.toLocaleString()` ni o'zi yozmaslik — `App.jsx` dagi `fmt()` helper.
10. **Modal — `useModalKeys`.** Yangi modal `Ctrl+Enter`/`Escape` ni qo'lda bog'lamasin, `useModalKeys(onSave, onClose)` chaqirsin.
11. **Hardcoded URL yo'q.** Faqat `import.meta.env.VITE_API_URL` orqali `lib/api.js` da.
12. **Polling visibility-aware.** `setInterval` ishlatilsa, `document.hidden` da `clearInterval`, `visibilitychange` da qaytarish (Dashboard shabloni).
13. **List 200+ qator kutilsa — debounced search + virtualization.** `useDeferredValue` yoki 300ms `setTimeout`; 1000+ uchun `@tanstack/react-virtual`.

### 3. Umumiy printsiplar

14. **Yarim feature qoldirmaslik.** Backend route bor — frontend page bor. Route bor lekin UI yo'q bo'lsa, yo UI ni qo'shing yo route ni o'chiring (Interactions misoli).
15. **Reuse — copy-paste man.** 3+ joyda takrorlanadigan kod helper/hook/component ga chiqarilsin. Lekin **3 marta ko'rinmaguncha** abstraktsiya yaratmaslik.
16. **`update: {}` aldamchi upsert qilmaslik.** `import.js` da `upsert` ishlatilsa, `update` blokida haqiqiy maydonlar bo'lsin yoki `--dry-run` flagi qo'shilsin.
17. **FK uchun `''` o'rniga `null`.** Optional FK schema da `?` bo'lsin va kodda `value || null` (mai `value || ''` emas).
18. **Comments — faqat NIMA UCHUN noaniq bo'lsa.** Kod nima qilishini o'zi izohlasin. PR description / commit message ga tegishli matnlar koddan tashqarida.
19. **Idempotent skriptlar.** Migratsiya/import kabi skript 2-marta ishlatilganda crash bermasin — `upsert`, `ON CONFLICT`, yoki `findFirst` + tekshiruv.
20. **Schema o'zgarsa — `prisma generate`.** `schema.prisma` ga tekkanidan keyin `npx prisma db push && npx prisma generate` ni unutmaslik. Aks holda TypeScript/IDE eski tipni ko'radi.

### 4. Ishonch va testlash

21. **"Ishladi" deyishdan oldin tekshirish.** Backend o'zgarsa — endpoint `curl`/Postman bilan urib ko'rilsin. Frontend o'zgarsa — `npm run dev` bilan brauzerda ko'rilsin.
22. **TEXNIK_VAZIFA.md ni har sessiyada o'qish.** Ish boshlashdan oldin "Joriy holat" va "Tahlil" bo'limlarini, ishlayotgan bosqich oxiridagi promtni o'qing.
23. **Bosqichni tugatganda TEXNIK_VAZIFA.md yangilash.** Status `TODO` → `DONE ✅`, "Joriy holat" sanasini bugungi ga, qilingan ish qisqa qayd etilsin.
