# BACKLOG — Mavjud modullarni rivojlantirish

> Foydalanuvchi takliflari. Saralash: **Umumiy** (barcha modulga) / **Modulga xos**.
> Ish turi: 🆕 yangi imkoniyat · ✨ UX · 🐛 tuzatish.
> Holat: ⬜ TODO · 🔄 ishlanmoqda · ✅ DONE · 💬 muhokama kerak.
> 15b (ombor) — keyinga qoldirilgan (TEXNIK_VAZIFA.md Bosqich 15b).

---

## 🌐 Umumiy (cross-cutting — barcha/ko'p modulга)

- ✅ **#3 — Ko'rinadigan amal izi + soft-delete + superAdmin** 🆕🐛 _(KATTA — 3a/3b bajarildi)_

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

  - ✅ **3b — "Kim/Qachon" ustuni + foydalanuvchi ranglari** _(2026-06-03)_
    - Backend: `GET /api/users/lookup` (har auth user, admin-guard'dan oldin); `clients.js`
      raw SELECT'ga createdById/updatedById/updatedAt.
    - Frontend: `fmtDateTime` + `userColor(id)` (lib/format), `useUsersLookup` hook,
      `AuditCell` komponent. 5 ro'yxatga "Kim / Qachon" ustuni — oxirgi tegingan foydalanuvchi
      (rangli) + vaqt (`updatedBy/At ?? createdBy/At`).
    - Testlar: `users-lookup.test` (non-admin lookup 200, admin endpoint 403).
      **Backend 101/101, lint 0 error, build OK, E2E 4/4.**
    - Eslatma: eski (3a'dan oldingi) yozuvlar "—" ko'rsatadi (createdById yo'q).

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

- ✅ **#3s — USD (eksport) savdosi print/detalda valyuta to'g'ri ko'rsatiladi** 🆕 _(2026-06-05)_
  Avval `PrintableInvoice` (yuk xati) va detal modal summalarni qattiq "UZS" deб yozardi —
  USD savdo bo'lsa ham. Endi USD savdoda summalar **USD da asosiy** + ostida **"≈ ... UZS (kurs N)"**
  ekvivalenti (foydalanuvchi qarori). Modul helperlari `curOf(sale)` + `dispAmount(sale, uzs)`
  (rowAmount/totalAmount UZS bazadan kursga bo'ladi) — print va detal ikkalasida ishlatiladi
  (yagona manba). UZS savdolar o'zgarmaydi. **Lint 0 error, build OK.**

- ✅ **#2s — USD savdoni tahrir/nusxalashda kurs ikki marta qo'llanishi tuzatildi** 🐛 _(2026-06-05)_
  USD savdoda `rowAmount` UZS bazada saqlanadi. Tahrir/nusxa narxni `rowAmount×1000/totalKg`
  dan tiklardi → bu UZS/tonna; forma uni USD deb bilib, saqlashda server **yana ×kurs** qilardi
  → summa **kurs barobar** (masalan 12500×) shishardi. Yangi `saleProductToRow(p, rate)` helperi
  USD savdoda narxni kursga bo'lib kirish valyutasiga (USD/tonna) qaytaradi; UZS uchun rate=1.
  Edit va Copy ikkala joy shu helperга ko'chirildi. **Node simulyatsiyada tasdiqlandi:** real USD
  savdo (12.5M, kurs 12500) — eski kod 156 mlrd (12500×) berardi, yangi kod 12.5M (−126 so'm =
  0.001% yaxlitlash qoldig'i, migratsiyasiz model bilan bir xil). **Lint 0 error, build OK.**

- ✅ **#1s — Spec'dan savdoga narx 1 tonna uchun o'giriladi** 🐛 _(2026-06-05)_
  Spetsifikatsiyadan savdo to'ldirilganda narx eski `unitPriceVat` (dona/kg/m²/m³ QQS-li
  birlik narxi) o'rniga endi to'g'ri **1 tonna narxi**ga o'giriladi — savdo narx modeliga
  (#9) mos. Frontend `Sales.jsx` `specProductToRow(sp, products)` helperi: spec qatori avval
  o'lchamlari bo'yicha kg ga konvertatsiya qilinadi, keyin `1 tonna narxi = rowTotal × 1000 / totalKg`.
  Shunda savdo qator summasi spec kelishilgan summasiga teng (QQS-li, yalpi). Ikki prefill joyi
  shu helperga ko'chirildi. Mahsulot **spec javobining o'zidan** (`sp.product`) olinadi —
  `products` propi yuklanish poygasida (Contracts'dan o'tilganda) bo'sh bo'lib narx bo'sh
  kelmasligi uchun. Migratsiya/backend yo'q. **Frontend lint 0 error, build OK; node simulyatsiyada
  (products=[] race) narx to'g'ri hisoblanishi tasdiqlandi.**

- ✅ **#9 — Narx modeli: doimo 1 tonna (1000 kg) uchun + konvertatsiya narx ekvivalenti** 🆕🐛 _(2026-06-04)_
  **Qaror:** pul DOIMO og'irlikdan hisoblanadi — `summa = (totalKg / 1000) × narx`. Birlik
  (dona/kg/m²/m³) faqat miqdor kiritish usuli; baribir kg ga konvertatsiya qilinib, ton narxidan
  pul chiqadi. Avval `summa = miqdor × narx` (default narx `priceCbm`) edi — dona×kub.m_narxi
  noto'g'ri natija berardi.
  - Backend: `lib/saleCalc.js` `computeSaleRow` — avval konvertatsiya, keyin
    `rowAmount = round((totalKg/1000) × narx × kurs)`.
  - Frontend `Sales.jsx`: `calculateRowValues` bir xil formula (kurssiz, kiritish valyutasida);
    mahsulot tanlanganda default narx **`priceTon`**; "Narx / tonna" ustun belgisi; edit/copy
    rekonstruksiyada narx `rowAmount×1000/totalKg` dan tiklanadi.
  - UI: konvertatsiya oynasiga **narx ekvivalenti** qatori qo'shildi — `narx/kg | narx/m² | narx/m³`
    (miqdorlar ostida).
  - Testlar: 4 faylda (sales/export-currency/integration/softdelete) summa/qarz assertionlari
    yangi formulaga ko'ra qayta hisoblandi. **Backend 106/106, frontend lint 0 error, build OK.**
  - ~~*Qamrovga kirmaydi:* spec'dan to'ldirilgan savdo narxi (hozircha eski `unitPriceVat`)~~ → **#1s da hal qilindi (2026-06-05)**.

- ✅ **#7 — Yuk xati sanasi shartnoma sanasidан avval bo'lmasin** 🐛 _(2026-06-03)_
  Server: `sales.js` POST/PUT da `assertSaleDateNotBeforeContract` (faqat kun bo'yicha,
  UTC) — shartnoma yoki spec sanasidan oldin bo'lsa 400. Frontend: `Sales.jsx` date input
  `min` = shartnoma sanasi + `save()` da tekshiruv (toast).

- ✅ **#6 — Eksport savdosi + ko'p valyuta (USD/UZS)** 🆕 _(2026-06-03)_
  **Qarorlar:** USD+UZS · summalar **UZS bazada** (kurs orqali — mavjud qarz/hisobot o'zgarmaydi) ·
  kurs har savdoda qo'lda · eksport **shartnoma valyutasidan**.
  - Sxema: `Contract.currency`, `Sale.currency`+`exchangeRate`, `Client.country` (informatsion).
  - Backend: `computeSaleRow(row, product, rate)` — `rowAmount = amount*price*kurs` (UZS baza);
    USD shartnoma → kurs majburiy (400 aks holda); currency server tomonidan shartnomadan;
    sales list `?currency=` filtri. Contracts/Clients valyuta saqlaydi.
  - Frontend: Sales forma USD shartnomada "Kurs" maydoni + USD kiritish; **Savdo (UZS)/Eksport (USD)
    tab** (eksport tabda Kurs + USD jami ustunlari); Contracts/Clients valyuta tanlovi; Clients mamlakat.
  - ✨ _(2026-06-04)_ Alohida "Savdo (UZS)/Eksport (USD)" tab tugmalari **olib tashlandi** — endi
    **"Eksport (USD)"** faktura quick-filter submenu qatoriga qo'shildi (Barchasi / Faktura berilgan /
    Faktura berilmagan yonida, o'ngda Globe icon bilan). Yagona single-select qator: faktura tablari →
    UZS ko'rinish, "Eksport (USD)" → USD ko'rinish. Lint 0 error.
  - Testlar: `export-currency.test` (USD→UZS hisob, kurssiz→400, currency filtri, debt UZS).
    **Backend 106/106, lint 0 error, build OK, E2E 4/4; jonli bazada tekshirildi (12.5M UZS).**
  *Qamrovga kirmaydi (kelajak):* to'lovlar USD'da, markaziy kurs jadvali, eksport PDF.

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
