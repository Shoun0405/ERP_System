# BACKLOG — Mavjud modullarni rivojlantirish

> Foydalanuvchi takliflari. Saralash: **Umumiy** (barcha modulga) / **Modulga xos**.
> Ish turi: 🆕 yangi imkoniyat · ✨ UX · 🐛 tuzatish.
> Holat: ⬜ TODO · 🔄 ishlanmoqda · ✅ DONE · 💬 muhokama kerak.
> 15b (ombor) — keyinga qoldirilgan (TEXNIK_VAZIFA.md Bosqich 15b).

---

## 🌐 Umumiy (cross-cutting — barcha/ko'p modulга)

- ⬜💬 **#3 — Ko'rinadigan amal izi (audit) + soft-delete + superAdmin** 🆕🐛 _(KATTA — sxema + barcha modul + rol)_
  Mahsulotlardan tashqari har modulda (Shartnoma, Savdo, Mijoz, To'lov, Spets, Aloqa)
  har yozuvda **kim qilgani** ko'rinib tursin:
  - Bitta ustun: **yaratgan/oxirgi tahrirlagan foydalanuvchi** + ostida **vaqti**.
  - Tahrirlanганда — oxirgi tahrirlovchi ko'rsatiladi; **oxirgi tahrir vaqti** ham.
  - **Soft-delete:** o'chirilganda butunlay o'chmaydi, "o'chirilgan" holatiga o'tadi
    (qizil bo'yalgan). **Faqat superAdmin** butunlay (hard) o'chira oladi.
  - Har foydalanuvchiga **alohida rang** (UI).
  *Sxema ta'siri:* ko'p modelga `createdById`, `updatedById`, `updatedAt`, `deletedAt`
  qo'shiladi; yangi **superAdmin** roli (hozir: admin/seller/user); soft-delete barcha
  list so'rovlarga `deletedAt IS NULL` filtri talab qiladi (arxitekturaviy).
  *Mavjud:* `AuditLog` modeli bor (tarix uchun) — bu esa **qatorga bog'langan ko'rinadigan
  atribut** + soft-delete (boshqa narsa).

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

- ⬜ **#1 — Sotuvchini shartnoma orqali biriktirish** ✨🆕🐛 _(katta — sxema + 3 modul)_
  Yagona oqim: mijozга ko'p sotuvchi → shartnomага 1 ta (mijoznikidan) → savdoга shartnomadan.

  **1a. Mijoz (Clients) — ko'p sotuvchi:** Hozir `Client.seller` bitta satr. Endi bir mijozga
  **istalgancha sotuvchi** biriktirish mumkin (Sozlamalardagi `sellers` ro'yxatidan).
  → Sxema (`Client.sellers`); Clients UI multi-select.

  **1b. Shartnoma (Contracts) — majburiy 1 sotuvchi:** Har shartnomага **aniq 1 ta**, faqat
  **shu mijozга biriktirilgан sotuvchilardan**. → `Contract.seller` majburiy + tegishlilik tekshiruvi.

  **1c. Savdo (Sales):** Shartnoma **optional qoladi**. Shartnoma tanlanса — sotuvchi
  shartnomadan **default** (tahrirlasa bo'ladi). Tanlanmaса — mijozning sotuvchilaridan.

  *Qarorlar (foydalanuvchi):* (a) tahrirlanadi ✓ · (b) shartnomага 1, mijozга ko'p ✓ ·
  (c) shartnomага doim 1 majburiy ✓ · savdoда shartnoma optional ✓
  *Loyiha qarori (keyin):* `Client.sellers` saqlash (Postgres `String[]` vs relation jadval).

### Hisobotlar (Reports)

- ⬜ **#2 — Sotuvchi bo'yicha hisobot (mijoz kartasi kabi)** 🆕 _(#1 ga bog'liq)_
  Mijoz kartasidagi kabi, lekin **sotuvchi kesimida**: sotuvchining qarzi bor-yo'qligi,
  oboroti. **Shartnoma kesimida** ham (mijoz kartasidagi "shartnomalar bo'yicha saldo" kabi).
  *Bog'liq:* #1 (sotuvchi tizimi) tayyor bo'lгач mantiqiy.

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
