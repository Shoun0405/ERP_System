# BACKLOG — Mavjud modullarni rivojlantirish

> Foydalanuvchi takliflari. Saralash: **Umumiy** (barcha modulga) / **Modulga xos**.
> Ish turi: 🆕 yangi imkoniyat · ✨ UX · 🐛 tuzatish.
> Holat: ⬜ TODO · 🔄 ishlanmoqda · ✅ DONE · 💬 muhokama kerak.
> 15b (ombor) — keyinga qoldirilgan (TEXNIK_VAZIFA.md Bosqich 15b).

---

## 🌐 Umumiy (cross-cutting — barcha/ko'p modulга)

- 🔄 **#3 — Ko'rinadigan amal izi + soft-delete + superAdmin** 🆕🐛 _(KATTA — 3a/3b ga bo'lindi)_

  - ✅ **3a — Soft-delete + superAdmin** _(2026-06-03)_
    - Sxema: 6 modelga (Client/Contract/Sale/Payment/Specification/Interaction)
      `deletedAt, deletedById, createdById, updatedById` (+ yo'qlariga `updatedAt`). 1 migratsiya.
    - superAdmin roli: `rbac.js` bypass + `requireSuperAdmin`; `_schemas` enum; Users.jsx opsiya+badge.
    - DELETE → **soft** (admin); `/:id/hard` + `/:id/restore` → **superAdmin** (har modul).
      Create/update'da `createdById`/`updatedById` yoziladi (3b uchun).
    - **Agregatlardan chiqarish:** barcha Sale/Payment SUM'ga `deletedAt IS NULL`
      (clients, dashboard, contracts, reports) — o'chirilgan void, qarz/oborotga kirmaydi.
    - Frontend: 5 ro'yxatda o'chirilgan qator **qizil** + superAdmin **Tiklash/Butunlay o'chirish**.
    - Testlar: `softdelete.test` (soft, agregat chiqarish, superAdmin hard/restore 403/200).
      **Backend 99/99, lint 0 error, build OK, E2E 4/4; jonli bazada tekshirildi (debt 10000→0).**

  - ⬜ **3b — Ko'rinadigan "kim/qachon" ustuni + foydalanuvchi ranglari** _(keyingi)_
    Har modulda yaratgan/oxirgi tahrirlovchi + vaqt ustuni; id'dan avtomatik rang;
    `GET /api/users/lookup` (id→fullName). Ma'lumot 3a'da yig'ila boshladi.

- ✅ **#4 — Vaqt bo'yicha saralashda SOAT ham hisobga olinsin** 🐛 _(2026-06-03)_
  List endpointlarda `date` saralashga ikkilamchi `createdAt` tiebreaker qo'shildi —
  bir kunlik yozuvlar endi soat bo'yicha tartiblanadi. Fayllar: `sales.js`, `payments.js`,
  `interactions.js`, `contracts.js`, `dashboard.js` (recent sales).

- ✅ **#5 — Qidiruv Enter bilan ishga tushsin** ✨ _(2026-06-03)_
  Yangi `hooks/useSearchOnEnter.js` — `query` faqat **Enter** bosilganda yoki maydon
  tozalanganda yangilanadi (server yuklamasi kam). 6 server-qidiruvli sahifa ko'chirildi:
  Clients, Products, Sales, Payments, Interactions, Contracts. Users/Reports — client-side
  filtr (server yuklamasi yo'q) — o'zgartirilmadi.

---

## 📦 Modulga xos

### Sotuvchi (seller) tizimi — Mijoz → Shartnoma → Savdo zanjiri

- ✅ **#1 — Sotuvchini shartnoma orqali biriktirish** ✨🆕🐛 _(2026-06-03)_
  **Storage qarori:** nom asosida qoldirildi (Seller jadval YO'Q) — `Client.seller` vergulli
  satr, `Contract.seller`/`Sale.sellerName` nom. Talablar (ledger #2, o'chirish cheklovi) nom
  asosida bajariladi; jadval migratsiyasi ortiqcha.
  - **1a** ✅ allaqachon bor edi (MultiSellerSelect + vergulli satr).
  - **1b** Contracts asosiy forma allaqachon; **Clients tezkor-modaliga** majburiy seller
    dropdown qo'shildi; **backend** (`contracts.js`) seller majburiy + mijoz a'zoligi tekshiruvi
    (POST 400 sellersiz/notegishli; PUT seller yuborilganda).
  - **1c** `Sales.jsx`: shartnoma tanlanганда sotuvchi shartnomadan default (tahrirlanadi);
    tanlanmaганда mijozning birinchisi.
  - **O'chirish cheklovi:** `settings.js` PUT — nomida shartnoma/savdo bor sotuvchini
    ro'yxatdan olib tashlash 400.
  - Testlar: contracts (sellersiz/notegishli → 400), yangi `settings.test` (cheklov). E2E 1c
    tasdiqlandi. **Backend 91/91, lint 0 error, build OK, E2E 4/4.**

### Hisobotlar (Reports)

- ✅ **#2 — Sotuvchi bo'yicha hisobot (sotuvchi kartasi)** 🆕 _(2026-06-03)_
  Hisobotlar → **Sotuvchi kartasi**: sotuvchilar ro'yxati (savdo/to'lov/qarz) + tanlangan
  sotuvchi **shartnoma kesimida** saldo (mijoz nomlari bilan), mijoz kartasi uslubida.
  - Backend: `reports.js` `GET /sellers-summary` + `GET /seller-by-contracts/:seller`
    (attribution **Contract.seller** orqali — to'lovda seller yo'q). SQL window running balance.
  - Frontend: `Reports.jsx` yangi `SellerStatementSection` + `ContractLedgerTable`ga mijoz nomi
    + MENU "Sotuvchi kartasi".
  - Testlar: `reports.test` sellers-summary (balance) + seller-by-contracts (saldo+mijoz).
    **Backend 93/93, lint 0 error, build OK; jonli bazada tekshirildi.**
  *Eslatma:* shartnomasiz savdolar qarz-ledgerга kirmaydi (ular `sales-by-seller` oborotida).

### Savdo (Sales)

- ✅ **#7 — Yuk xati sanasi shartnoma sanasidан avval bo'lmasin** 🐛 _(2026-06-03)_
  Server: `sales.js` POST/PUT da `assertSaleDateNotBeforeContract` (faqat kun bo'yicha,
  UTC) — shartnoma yoki spec sanasidan oldin bo'lsa 400. Frontend: `Sales.jsx` date input
  `min` = shartnoma sanasi + `save()` da tekshiruv (toast).

- ⬜💬 **#6 — Eksport savdosi + ko'p valyuta (USD/UZS)** 🆕 _(KATTA — sxema + Savdo submenu)_
  Eksport hisobini yuritish uchun valyuta qo'shiladi:
  - **Mijoz** — mamlakat (country).
  - **Shartnoma** — valyutasi.
  - **Savdo** — savdo valyutasi + eksport bo'lса **valyuta kursi** (float): USD × kurs = UZS.
  - Eksport savdosi ham UZS da yuritiladi (kurs orqali).
  - **Savdo ichida "Export" submenu:** asosiy Savdo oynasi faqat **UZS**; Export submenu
    **ham USD ham UZS**.
  *Sxema:* `Client.country`, `Contract.currency`, `Sale.currency` + `Sale.exchangeRate`.
  *Eslatma:* "Yana qo'shimchalar qilamiz" — to'liq spetsifikatsiya keyin.

### To'lovlar → Bank (qayta loyihalash)

- ⬜💬 **#8 — "Tushumlar" → "Bank" moduli** 🆕 _(KATTA — sxema qayta + navigatsiya)_
  Tushumlar moduli tubdан o'zgaradi:
  - Nomi **"Bank"** ga o'zgaradi.
  - **Navigatsiya:** Bank menyusi mijozларда tepага; Mahsulotlar Sozlamалар menyusi tepасига.
  - **2 submenu:** 1) Bank, 2) Kassa — hisoblari **alohida** yuritiladi.
  - Ikkalasида ham **tushum (kirim) va chiqim** bo'ladi.
  - **Bank hisobi:** excel/csv/txt fayl yuklash orqали to'ldirish/qo'shish.
  *Status:* 💬 **To'liq muhokama kerak** — foydalanuvchi bank oborotkasini beradi, o'rganib
  data baza tuzilishi birgа hal qilinadi.

---

## ✅ Bajarilgan

- ✅ **Bosqich 15a** — C-2 (savdo summasi server tomonда) + H-2 (raqamlash advisory lock).
  Commit `ff4c5a3`, push qilingan. (TEXNIK_VAZIFA.md 15a)
