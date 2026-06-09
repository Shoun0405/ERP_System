# Mijozlarni Excel orqali import qilish — Dizayn

**Sana:** 2026-06-09
**Modul:** Clients (CRM)
**Holat:** Dizayn tasdiqlangan, implementatsiya rejasi kutilmoqda

## 1. Maqsad

Foydalanuvchi tayyor Excel (`.xlsx`) shablonni saytdan yuklab oladi, mijozlar
ma'lumotini to'ldiradi va qaytadan yuklaydi. Tizim faylni tekshiradi, qatorlarni
toifalaydi, foydalanuvchiga **interaktiv preview** ko'rsatadi (har bir qatorni
qo'lda chiqarib tashlash mumkin), so'ng tasdiqlangach mijozlarni bazaga qo'shadi.

## 2. Qarorlar (foydalanuvchi bilan kelishilgan)

| Savol | Qaror |
|---|---|
| Dublikat STIR (bazada mavjud) | O'tkazib yuborish + ogohlantirish (yangilamaymiz) |
| Xato/bo'sh qatorlar | Partial: to'g'rilarini import, xatolarni hisobotda ko'rsatish |
| Preview | Ha — avval tekshiruv, keyin tasdiqlash |
| Shablon ustunlari | 8 ustun + Telefon = 9 ustun |
| Preview nazorati | Faqat olib tashlash (jadvalda qiymat tahrirlash YO'Q) |

## 3. Shablon ustunlari (9 ta)

Header nomi bo'yicha o'qiladi — ustun tartibi muhim emas.

| Ustun sarlavhasi | Field | Majburiy | Izoh |
|---|---|---|---|
| Nomi | `name` | ✅ | Bo'sh bo'lsa — `error` |
| STIR | `inn` | — | `@unique`; bazada bor bo'lsa — `duplicate` |
| Telefon | `phone` | — | |
| Direktor | `director` | — | |
| Manzil | `address` | — | |
| Hisob raqami | `account` | — | maks 20 belgi |
| MFO | `mfo` | — | maks 5 belgi |
| Bank | `bank` | — | |
| Sotuvchi | `seller` | — | |

- `status` → avtomatik `'Yangi'` (clientSchema default).
- `category`, `country` → shablonda yo'q, bo'sh qoladi.
- Shablon tarkibi: qalin sarlavha qatori + 1 namuna qator + alohida **"Yo'riqnoma"**
  varag'i (qoidalar: Nomi majburiy, STIR takrorlanmasin, ortiqcha ustun qo'shmang).

## 4. Qatorlarni toifalash

`name` bo'sh-emasligi va boshqa maydonlarni **xom (raw) qiymat** asosida tekshiramiz
(clientSchema `default('')` bo'sh maydonni `''` ga aylantirgani uchun, toifalashdan
oldin xomlikni saqlaymiz). Toifalashdan keyin yaroqli qatorlar `clientSchema.parse`
orqali tozalanadi.

"To'liqlik" maydonlari (7 ta): `{ inn, director, address, account, mfo, bank, seller }`.
`name` — majburiy (bo'lmasa `error`); `phone` — to'liqlikka kirmaydi.

| Toifa | Shart | Import? |
|---|---|---|
| 🟢 `valid` | Nomi bor + 7 ta to'liqlik maydoni ham to'la + qiymatlar to'g'ri | Ha (default belgilangan) |
| 🔵 `incomplete` | Nomi bor, lekin 7 ta to'liqlik maydonidan ≥1 tasi bo'sh | Ixtiyoriy (default belgilanmagan) |
| 🟡 `duplicate` | STIR bazada allaqachon mavjud | Yo'q (kulrang, sabab ko'rsatiladi) |
| 🔴 `error` | Nomi bo'sh / qiymat noto'g'ri (mas. MFO > 5) / STIR fayl ichida takror | Hech qachon |

> Eslatma: `phone` bo'sh bo'lishi `incomplete`ga sabab bo'lmaydi (foydalanuvchi
> dastlab uni "majburiy emas" deb belgilagan).

## 5. Backend

### 5.1 Endpointlar (`backend/routes/clients.js`)

| Endpoint | Body | Vazifa |
|---|---|---|
| `GET /api/clients/import/template` | — | Tayyor `.xlsx` shablon (ExcelJS) |
| `POST /api/clients/import/preview` | raw `.xlsx` (Buffer) | Parse + validatsiya + toifalash. **DB ga yozmaydi.** |
| `POST /api/clients/import/commit` | JSON `{ clients: [...] }` | Tasdiqlangan qatorlarni import + audit log |

- Barchasi `requirePermission('clients', 'create')` bilan himoyalanadi.
- `preview` faylni `express.raw({ type: [XLSX_MIME, 'application/octet-stream'], limit: '10mb' })`
  bilan qabul qiladi → `workbook.xlsx.load(req.body)`. Global `express.json()` faqat
  `application/json`ni parse qilgani uchun bu ziddiyatsiz.
- Marshrutlar tartibi: `/import/*` lar `/:id` dan **oldin** kelishi shart (Express
  `'/import'` ni `:id` deb o'qib qo'ymasligi uchun).

### 5.2 Yordamchi modul: `backend/lib/clientImport.js`

Preview va commit ikkalasida ishlatiladi (reuse — CLAUDE.md #15).

```
parseClientsXlsx(buffer)
  → { headerOk: bool, rows: [{ rowNum, raw: {name, inn, phone, ...} }] }
  (header nomlari topilmasa headerOk=false)

categorize(rows, existingInns)
  → [{ rowNum, name, inn, category, reason, data }]
  - existingInns: Set — bazadagi mavjud STIR lar (preview uchun bir marta query)
  - fayl ichidagi STIR takrorini ham aniqlaydi
  - data: clientSchema.parse natijasi (faqat valid/incomplete uchun)
```

### 5.3 Preview oqimi

1. `parseClientsXlsx(req.body)` — header tekshir; xato bo'lsa `400 { error: 'Shablon ustunlari topilmadi...' }`.
2. Qatorlar soni > 2000 → `400 { error: "2000 dan ortiq qator..." }` (sokin kesish yo'q — CLAUDE.md).
3. `existingInns` = `SELECT inn FROM "Client" WHERE inn IS NOT NULL` (bitta query, N+1 yo'q).
   `@unique` cheklovi soft-delete qilingan qatorlarni ham qamrab oladi, shuning uchun
   `deletedAt` bo'yicha filtrlamaymiz — aks holda commit'da unique xato chiqadi.
4. `categorize(...)` → javob:

```json
{
  "summary": { "total": N, "valid": n, "incomplete": n, "duplicate": n, "error": n },
  "rows": [ { "rowNum": 2, "name": "...", "inn": "...", "category": "valid", "reason": null } ]
}
```

`reason` faqat `duplicate`/`error` uchun to'ldiriladi (UI'da ko'rsatish uchun).
`valid`/`incomplete` qatorlarning to'liq `data`si ham javobda bo'ladi (frontend
commit'ga qaytarishi uchun).

### 5.4 Commit oqimi

1. `clients` massivini Zod bilan qayta tekshir: `z.array(clientSchema).max(2000)`.
   (Frontend yuborgan ma'lumotga ko'r-ko'rona ishonmaymiz — CLAUDE.md #5/#6.)
2. `existingInns`ni **qayta** query (preview va commit orasida yangi mijoz qo'shilgan bo'lishi mumkin).
3. INN si bo'sh-bo'lmagan va `existingInns`da bor qatorlarni chiqarib tashla.
4. `prisma.client.createMany({ data: rows.map(r => ({ ...r, createdById: req.user.id })), skipDuplicates: true })`
   — bitta atomik INSERT; qolgan dublikat poyga holatini `skipDuplicates` (`ON CONFLICT DO NOTHING`) hal qiladi.
5. `logAudit(req.user.id, 'import', 'client', null, { inserted: count, requested }, req)` — bitta yig'ma yozuv.
6. Javob: `{ inserted: count, skippedDuplicate: requested - count, requested }`.

> `createMany` relations talab qilmaydi va eng samarali; per-qator audit o'rniga
> bitta yig'ma audit yozuvi (count + summary) yetarli.

## 6. Frontend

### 6.1 Toolbar (`Clients.jsx`)

Mavjud "Excel (export)" tugmasi yoniga 2 tugma, faqat `canCreate` bo'lsa:

- **"Shablon"** (`Download` icon) → `downloadFile('/api/clients/import/template', 'mijozlar-shablon.xlsx')`.
- **"Import"** (`Upload` icon) → `ClientImportModal` ochadi.

### 6.2 Yangi komponent: `frontend/src/pages/ClientImportModal.jsx`

`Clients.jsx` allaqachon katta — modal alohida fayl (CLAUDE.md #14/#15).

**Holatlar:** `idle → previewing → preview-ready → committing → done`.

1. **Fayl tanlash** (`<input accept=".xlsx">`). Tanlangach faylni `ArrayBuffer` sifatida
   o'qib, `api.post('/api/clients/import/preview', buffer, { headers: { 'Content-Type': XLSX_MIME } })`.
2. **Preview ko'rinishi:**
   - 4 ta hisob kartasi (valid / incomplete / duplicate / error).
   - Toifalangan qatorlar jadvali: `☑ | # | Nomi | STIR | Holat (badge) | Sabab`.
     - `valid` → checkbox belgilangan, faol;
     - `incomplete` → checkbox belgilanmagan, faol;
     - `duplicate`/`error` → checkbox o'chirilgan (kulrang) + sabab.
   - "Hammasini belgilash / olib tashlash" + jonli hisob: **"N qator import qilinadi"**.
   - Foydalanuvchi xohlagan importable qatorni belgisini olib tashlay oladi.
3. **Tasdiqlash** → belgilangan qatorlarning `data`sini yig'ib
   `api.post('/api/clients/import/commit', { clients })` → `toast.success("X mijoz qo'shildi, Y o'tkazildi")`
   → `onDone()` (ro'yxat `fetchClients()` bilan yangilanadi) → modal yopiladi.
4. `useModalKeys(onConfirm, onClose)`, `react-hot-toast`, `fmt` ishlatiladi.

## 7. Qo'shimcha talablar

- **i18n:** barcha yangi matnlar `clients.import.*` (va kerakli `common.*`) kalitlari
  orqali uz/ru/zh locale fayllariga qo'shiladi. `npm run i18n:check` o'tishi shart.
- **Limit:** maks 2000 qator/fayl, maks 10MB upload.
- **Xatolar:** yaroqsiz/buzilgan fayl → `400` do'stona xabar; kutilmagan xato →
  markaziy error middleware (`{ error: 'Server xatosi' }`, ichki `console.error`).
- **RBAC:** uchala endpoint `clients:create`; frontend tugmalar `canCreate` bilan gate.

## 8. Testlar

- `backend/lib/clientImport.test.js` (vitest): toifalash mantiqi — valid/incomplete/
  duplicate (DB va fayl-ichi)/error holatlari; header topilmasligi; bo'sh fayl.
- `backend/routes/clients.import.test.js` (supertest): template 200 + xlsx mime;
  preview to'g'ri summary; commit insert + dublikat skip + audit; ruxsatsiz → 403.

## 9. Non-goals (bu bosqichda emas)

- Preview jadvalida qiymatlarni inline tahrirlash.
- Dublikat STIRni yangilash (upsert).
- CSV yoki boshqa formatlar (faqat `.xlsx`).
- Mahsulot/to'lov kabi boshqa modullar uchun import (alohida bosqich).

## 10. O'zgaradigan/yangi fayllar

**Yangi:**
- `backend/lib/clientImport.js`
- `backend/lib/clientImport.test.js`
- `backend/routes/clients.import.test.js`
- `frontend/src/pages/ClientImportModal.jsx`

**O'zgartiriladi:**
- `backend/routes/clients.js` — 3 endpoint + `express.raw` + marshrut tartibi
- `frontend/src/pages/Clients.jsx` — 2 toolbar tugmasi + modal ulanishi
- `frontend/src/locales/{uz,ru,zh}/...` — `clients.import.*` kalitlari
- `TEXNIK_VAZIFA.md` — bosqich qaydi (CLAUDE.md #23)
