---
name: yangi-modul
description: ERP tizimga yangi entity (modul) qo'shish — Prisma model + Zod schema + backend route + frontend page. CLAUDE.md dagi 23 ta qoidaga (pagination, shared prisma, $transaction, fmt, useModalKeys, toast, shared api) majburiy rioya qiladi. QACHON ishlatish: foydalanuvchi "yangi modul", "yangi entity", "yangi jadval/sahifa qo'sh", yoki mavjud bo'lmagan biror obyekt uchun CRUD so'raganda.
---

# Yangi modul qo'shish

ERP tizimga to'liq yangi entity qo'shish. **Yarim feature qoldirilmaydi** (CLAUDE.md #14): backend route bo'lsa — frontend page ham bo'lishi shart.

## 0. Boshlashdan oldin

1. `TEXNIK_VAZIFA.md` ning "Joriy holat" va "Tahlil" bo'limlarini o'qing (CLAUDE.md #22).
2. Foydalanuvchidan entity nomi, maydonlari va bog'lanishlarini (FK) aniqlang. Noaniq bo'lsa — `AskUserQuestion` bilan so'rang.
3. Mavjud o'xshash modulni shablon sifatida oching (masalan `routes/clients.js` + `pages/Clients.jsx`) va uning uslubini takrorlang.

## 1. Prisma model (`backend/prisma/schema.prisma`)

- PK: `id String @id @default(uuid())` (CLAUDE.md — barcha PK UUID).
- Optional FK uchun `?` ishlating; kodda `value || null` (hech qachon `|| ''` — #17).
- Barcha FK va tez-tez filtrlanadigan maydonlarga `@@index` qo'ying.
- Pul maydonlari `Decimal @db.Decimal(18,2)` (Float emas — loyiha shu turga ko'chgan).
- Soft-delete kerak bo'lsa loyihadagi mavjud pattern (`deletedAt`/audit) ni ko'ring.
- Schema o'zgargach **majburiy** (CLAUDE.md #20):
  ```bash
  cd backend && npx prisma db push && npx prisma generate
  ```

## 2. Zod schema (`backend/routes/_schemas.js`)

- Schema'ni **markazlashtirilgan** `_schemas.js` ga qo'shing va `module.exports` ga eksport qiling (#5).
- `z.coerce.number()` raqamlar uchun, FK uchun `z.string().uuid()`.
- Optional+default ziddiyatsiz: `z.string().max(N).nullable().default(null).transform(v => v || null)` patternidan foydalaning (mavjud `clientSchema`, `contractSchema` kabi).
- Server hosil qiladigan qiymatlar (hisoblangan summa va h.k.) klientdan QABUL QILINMAYDI — faqat ishonchli xom kirishlar (`saleProductSchema` izohiga qarang).

## 3. Backend route (`backend/routes/<entity>.js`)

Shablon: `routes/clients.js` (oddiy) yoki `routes/contracts.js` (pagination + aggregate SQL).

- `const prisma = require('../prisma')` — shared instance, **hech qachon** `new PrismaClient()` (#3).
- **GET `/`** — pagination majburiy (#4): `?page&limit&search&sortBy`, default `limit=50`, max `200`, response `{ data, total, page, limit }`.
- List endpointda `include: { sales, payments }` **YO'Q** (N+1 — #1). Aggregate kerak bo'lsa `prisma.$queryRaw` + `GROUP BY` (`routes/dashboard.js` shabloni).
- **POST/PUT** — `_schemas.js` dan Zod bilan `safeParse`, xato bo'lsa `400` + validatsiya xabari.
- 2+ tabel yoziladigan joyda `prisma.$transaction` (atomic — #2).
- Mijozga `e.message` qaytarmang — markazlashgan error handling, ichkarida `console.error` (#6).
- Auth/RBAC: mavjud `routes/` larda middleware qanday qo'llanganini ko'ring (`auth.js`, GET RBAC) va shu pattern'ni takrorlang.
- `backend/server.js` ga routerni mount qiling.

## 4. Frontend page (`frontend/src/pages/<Entity>.jsx`)

Shablon: `pages/Clients.jsx` yoki inline-form uchun `pages/Contracts.jsx` (`useInlineForm`).

- `import api from '../lib/api'` — shared instance, `api.get('/api/...')` (#7, #11). Hardcoded URL yo'q.
- `alert()` **taqiqlangan** — `react-hot-toast`/`sonner` toast ishlating (#8).
- Raqamlar: `App.jsx` dagi `fmt()` helper (#9). `n.toLocaleString()` ni qo'lda yozmang.
- Modal: `useModalKeys(onSave, onClose)` — Ctrl+Enter/Escape (#10).
- 200+ qator kutilsa: debounced search (`useDeferredValue` yoki 300ms) (#13).
- Polling kerak bo'lsa: visibility-aware (`document.hidden` da `clearInterval`) — Dashboard shabloni (#12).
- `App.jsx` ga route va sidebar elementini qo'shing (Sidebar/TopHeader).

## 5. Tekshirish (CLAUDE.md #21 — majburiy)

`tekshiruv` skilliga qarang. Qisqacha:
- Backend: endpoint'ni `curl`/Invoke-RestMethod bilan urib ko'ring (GET + POST).
- Frontend: `npm run dev` + `npm run lint`, brauzerda yangi sahifa ochiladimi, CRUD ishlaydimi.

## 6. Yakun

`vazifa-yopish` skilli orqali `TEXNIK_VAZIFA.md` ni yangilang (#23).
