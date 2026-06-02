# MIQYOSLASH.md — Kelajakka tayyorgarlik / Profilaktik arxitektura

> **Maqsad:** dastur rivojlanib kattalashib, murakkablashib ketganda kelib chiqadigan
> muammolarni **oldindan** hisobga olib, qaysi profilaktik ishlarni qachon qilishni
> belgilash. Bu fayl `TEXNIK_VAZIFA.md` (Bosqich 1–17) dan **keyingi** qatlam — uni
> takrorlamaydi, davom ettiradi.
>
> **Holat:** REJA (yo'l xaritasi). Hali kod o'zgartirilmagan.
> **Oxirgi yangilanish:** 2026-06-02.

---

## 1. Doira (scope) va asosiy tushuncha

**Maqsadli miqyos: 5–50 ichki foydalanuvchi, bitta kompaniya, bitta server.**

Bu miqyosda "kattalashish" — bu **ko'p trafik emas**. U quyidagi 3 ko'rinishda keladi:

1. **Ko'proq kod (murakkablik).** `Sales.jsx` ~1442 qator, `App.jsx` ~638 qator, 9+ sahifa.
   TypeScript yo'q; umumiy ma'lumot-qatlami yo'q — har sahifa `useState`+`axios`+300ms
   debounce mantig'ini qaytadan yozadi. Kod o'sgani sayin xato qilish osonlashadi.
2. **Ko'proq to'plangan ma'lumot.** `AuditLog` cheksiz o'sadi; `Sale`/`Payment` jadvallari
   yillar bo'yi to'planadi; offset-pagination katta jadvalda sekinlashadi.
3. **Bir xil ma'lumotni bir vaqtda tahrirlovchi ko'proq odam.** Race-condition, bir-birini
   "ust-ust bosib" yozish (lost update), raqamlash to'qnashuvi.

Shuning uchun e'tibor: **barqarorlik, ma'lumot butunligi (vaqt o'tishi bilan), regressiyani
oldini olish, kod murakkablashganda boshqarib turish.** Tezlik/trafik optimallashtirish emas.

### 1.1. Ataylab HOZIR QILMAYDIGAN ishlar (anti-over-engineering)

CLAUDE.md 15-qoida: *"3 marta ko'rinmaguncha abstraktsiya yaratmaslik."* Quyidagilar
5–50 user uchun **erta optimallashtirish** — qilinmaydi, faqat *trigger* belgisi kuzatiladi:

| Ish | Qachon qayta ko'rib chiqilsin (trigger) |
|---|---|
| Redis kesh | Sozlama/katalog so'rovlari sekinlashsa **yoki** > 200 so'rov/min |
| Message-queue (Bull) | Eksport/PDF so'rov-ipini bloklab, foydalanuvchi kutsa (sekund+) |
| Ko'p-instans + load-balancer | Bitta PM2 instans CPU/RAM yetmay qolsa **yoki** > 50 faol user |
| Kubernetes / konteyner-orkestratsiya | Bir nechta server kerak bo'lganda |
| GraphQL | Network-waterfall jiddiy muammo bo'lganda (hozir REST yetarli) |
| DB read-replica / sharding | Bitta Postgres instans yuk ko'tara olmay qolsa |

> **Qoida:** bu jadvaldagi ish *triggeri* yuzaga kelmaguncha boshlanmaydi. Erta qilingan
> miqyoslash — yo'qotilgan vaqt va qo'shilgan murakkablik.

---

## 2. Profilaktik bosqichlar

Har bosqich: **Muammo → Profilaktika → Qabul mezoni → Trigger (qachon)**.

---

### Bosqich 18 — Migratsiya intizomi + zaxira/tiklash
**Holat: TODO | Ustuvorlik: 🔴 POYDEVOR (birinchi) | Mehnat: o'rta**

**Muammo.** Hozir sxema `prisma db push` bilan tarqatiladi (dev-rejim, **versiyasiz**).
Sxema o'sib, prod-baza ma'lumotga to'lgach `db push` xavfli: migratsiya tarixi yo'q,
`--force-reset` = barcha ma'lumot yo'qoladi. Zaxira bor-yo'qligi va **tiklab bo'lish-bo'lmasligi**
sinab ko'rilmagan.

**Profilaktika.**
- `prisma db push` → `prisma migrate dev` (lokal) + `prisma migrate deploy` (prod) ga o'tish.
- `backend/prisma/migrations/` papkasini git ga commit qilish (sxema tarixi = audit).
- Avtomatik **kunlik `pg_dump`** (cron/PM2) + zaxirani **server tashqarisiga** nusxalash.
- **Restore-drill:** zaxirani bo'sh bazaga tiklash skripti — backup emas, *tiklash* sinaladi.

**Qabul mezoni.** Yangi migratsiya `migrate deploy` bilan qo'llanadi; `migrations/` git da;
bo'sh bazaga restore sinovi muvaffaqiyatli yakunlanadi; `db push` faqat dev muhitda.

**Trigger.** **Darhol** — bu boshqa hammasining poydevori. Prod-bazaga real ma'lumot
kiritilishidan oldin bo'lishi shart.

---

### Bosqich 19 — Frontend ma'lumot-qatlami + komponent refaktori
**Holat: TODO | Ustuvorlik: 🟠 yuqori | Mehnat: katta (bosqichma-bosqich)**

**Muammo.** 9 sahifada `useState`+`axios`+300ms-debounce takrorlanadi; kesh, request-dedup,
stale-so'rovni bekor qilish (`AbortController`) yo'q — bir sahifaga qaytganda to'liq
qayta-fetch (backend yukini ham oshiradi). `Sales.jsx` ~1442 qatorlik monolit; Modal,
Table, Pagination, FormField bir necha sahifada ko'chirma (copy-paste).

**Profilaktika.**
- **TanStack Query (react-query)** ni ma'lumot-qatlami sifatida kiritish: server-state
  kesh, request-dedup, `AbortController`, qayta-fetch boshqaruvi. Bu murakkablikni
  *kamaytiradi* (har sahifadagi qo'lyozma `useEffect`-larni olib tashlaydi) va backend
  so'rovlar sonini tushiradi.
- Ulkan sahifalarni feature-papka + kichik komponentlarga bo'lish (masalan `pages/sales/`
  → `SaleForm`, `SaleRow`, `SaleTable`, `useSaleCalc`).
- 3+ marta takrorlangan UI ni umumiy primitivlarga chiqarish (`components/Modal`, `Table`,
  `Pagination`, `FormField`) — **ammo 3x ko'rinmaguncha emas** (15-qoida).
- Marshrut bo'yicha `React.lazy()` + `Suspense` (code-splitting) — boshlang'ich bundle
  hajmini kamaytiradi.

**Qabul mezoni.** Bitta pilot sahifa (tavsiya: `Clients.jsx`) react-query ga ko'chirilib,
boshqalar uchun **shablon** bo'ladi; `Sales.jsx` mantig'i kichik bo'laklarga ajratiladi;
sahifalar `React.lazy` bilan yuklanadi.

**Trigger.** Kod og'irlashganda / yangi sahifa qo'shganda har gal bir xil mantiqni qayta
yozayotgan bo'lsangiz. Pilotdan keyin har yangi/tahrirlangan sahifa shablonga o'tkaziladi.

---

### Bosqich 20 — Kuzatuvchanlik (observability) + CI/CD
**Holat: TODO | Ustuvorlik: 🟠 yuqori | Mehnat: o'rta**

**Muammo.** Tarkibiy log yo'q (`app.js` faqat `console.error` — L-3); Sentry ixtiyoriy;
har push da avtomatik test/lint/build yo'q (Bosqich 17 da rejalashtirilgan — bu yerda
kuchaytiriladi). Muammo yuz berganda nima bo'lganini bilish qiyin.

**Profilaktika.**
- **`pino`** tarkibiy log (JSON) + log rotatsiya + har so'rovga `request-id` (tracing).
- **Sentry ni majburiy** qilish (hozir ixtiyoriy) — backend xatolar + frontend.
- **GitHub Actions CI:** har push/PR da `npm test` + `npm run lint` + `npm run build` +
  `prisma migrate` tekshiruvi. CI yashil bo'lmasa merge bloklanadi.
- **`npm audit` / Dependabot** — bog'liqlik xavfsizligi (mavjud H-6 `xlsx@0.18.5` CVE shu
  yerda avtomatik kuzatiladi).

**Qabul mezoni.** Xatolar Sentry ga tushadi; loglar JSON + request-id bilan; PR ochilganda
CI ishlaydi va muvaffaqiyatsiz bo'lsa merge to'siladi.

**Trigger.** Bosqich 17 (CI) bilan birga; jamoaga ikkinchi developer qo'shilishidan oldin.

---

### Bosqich 21 — Ma'lumot hayot-sikli (data o'sganda ishlashni saqlash)
**Holat: TODO | Ustuvorlik: 🟡 o'rta | Mehnat: o'rta**

**Muammo.** `AuditLog` cheksiz o'sadi (M-7, to'liq payload saqlanadi); offset-pagination
100k+ qatorda sekinlashadi (`OFFSET` jadvalni skanlaydi); `Sale`/`Payment` yillar bo'yi
to'planadi.

**Profilaktika.**
- **Audit retention + arxivlash** skripti: payload diff-only saqlash (Bosqich 16 bilan
  sinxron), N oydan eski yozuvlarni arxivlash/o'chirish (idempotent — 19-qoida).
- Katta jadvallarda **keyset (cursor) pagination** (`WHERE id < :cursor ORDER BY id DESC
  LIMIT n`) — offset o'rniga, doimiy tezlik.
- **`EXPLAIN ANALYZE`** bilan sekin hisobotlarni davriy ko'rib chiqish; kerakli indekslarni
  qo'shish (yangi filtr/sort maydoni paydo bo'lganda).
- Eski yillarni arxiv/partition (`Contract.yearPart` allaqachon mavjud — partition kaliti
  sifatida ishlatish mumkin).

**Qabul mezoni.** Audit retention skripti idempotent ishlaydi; eng katta jadvalda asosiy
hisobot so'rovi belgilangan vaqt ichida (masalan < 500ms) bajariladi.

**Trigger.** `AuditLog` yoki `Sale`/`Payment` ~100k qatordan oshganda; yoki hisobot
sezilarli sekinlashganda.

---

### Bosqich 22 — Bir vaqtli tahrir butunligi + tip xavfsizligi
**Holat: TODO | Ustuvorlik: 🟡 o'rta | Mehnat: o'rta**

**Muammo.** Ikki foydalanuvchi bir yozuvni bir vaqtda tahrir qilsa — sokin "lost update"
(oxirgi yozgan g'olib, birinchisining o'zgarishi yo'qoladi, ogohlantirishsiz). TypeScript
yo'q — sxema o'sganda `undefined`/`NaN` jim tarqaladi (masalan `Sales.jsx` ko'p-birlik
hisobida `cbmPerPce` yo'q bo'lsa).

**Profilaktika.**
- **Optimistik blok:** PUT so'rovida mijoz o'qigan `updatedAt` (yoki `version`) yuboriladi;
  server mos kelmasa 409 "boshqa foydalanuvchi o'zgartirdi, sahifani yangilang" qaytaradi.
  (Bosqich 15 dagi DB-lock kabi past-darajali emas — bu UX-darajadagi himoya.)
- **Umumiy Zod sxemalar:** `_schemas.js` ni FE/BE o'rtasida bo'lingan paket qilish (yagona
  haqiqat manbai) — yoki bosqichma-bosqich **TypeScript / JSDoc** kiritish (avval `lib/` va
  yangi fayllar).

**Qabul mezoni.** Eskirgan `updatedAt` bilan PUT → 409; mijoz tushunarli xabar oladi;
umumiy tip/sxema ikkala tomonda ishlatiladi.

**Trigger.** Bir nechta odam bir vaqtda bir mijoz/shartnomani tahrir qila boshlaganda
(masalan ikkinchi operator qo'shilganda).

---

## 3. Ustuvorlik matritsasi

| Bosqich | Ta'sir | Mehnat | Qachon boshlash (trigger) |
|---|---|---|---|
| **18** Migratsiya + backup/restore | 🔴 kritik | o'rta | **Darhol** — prod ma'lumotidan oldin |
| **20** Observability + CI/CD | 🟠 yuqori | o'rta | Bosqich 17 bilan / 2-developer qo'shilganda |
| **19** FE ma'lumot-qatlami + refaktor | 🟠 yuqori | katta | Kod og'irlashganda, bosqichma-bosqich |
| **21** Ma'lumot hayot-sikli | 🟡 o'rta | o'rta | ~100k qator / hisobot sekinlashganda |
| **22** Bir vaqtli tahrir + tip xavfsizligi | 🟡 o'rta | o'rta | 2+ odam bir yozuvni tahrir qilganda |

> Tartib: **18 → 20 → 19 → 21 → 22**. 18 poydevor; 20 regressiyani to'sadi; 19 murakkablikni
> jilovlaydi; 21–22 ma'lumot/foydalanuvchi o'sgach kerak bo'ladi.

---

## 4. Kesishuvchi (cross-cutting) printsiplar

- **CLAUDE.md 23 qoidasini mashina bilan tekshirish.** Hozir qoidalar matnda — kod/jamoa
  o'sganda buziladi. ESLint qoidalari yozish: to'g'ridan-to'g'ri `axios` import taqiqi
  (faqat `lib/api`), `alert()` taqiqi, hardcoded URL taqiqi. Buzilsa CI yiqiladi.
- **ADR (Architecture Decision Records).** Har yirik qarorni (`docs/adr/NNNN-*.md`) qisqa
  yozib borish — "nima uchun" ni kelajak uchun saqlash (18-qoida ruhida).
- **"Yarim feature qoldirmaslik" (14-qoida).** Backend route bo'lsa — UI bo'lsin; aks holda
  o'chirilsin.
- **Idempotent skriptlar (19-qoida).** Backup/retention/arxiv skriptlari 2-marta ishga
  tushganda crash bermasin.

---

## 5. Bu fayldan keyin

Bu yo'l xaritasi **reja** — implementatsiya alohida sessiyalarda, bosqichma-bosqich
bajariladi. Har bosqich tugaganda:
- `Holat: TODO` → `DONE ✅` qilinadi, qisqa "nima qilindi" qayd etiladi.
- Tegishli o'zgarishlar `TEXNIK_VAZIFA.md` "Joriy holat" iga ham yoziladi (22–23 qoidalar).
