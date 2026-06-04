---
name: tekshiruv
description: "Ishladi" deyishdan oldin o'zgarishni haqiqatan tekshirish (CLAUDE.md #21) — backend endpointni curl/Invoke-RestMethod bilan urib ko'rish, frontend uchun npm run lint + npm run dev, brauzerda xulq-atvorni kuzatish. QACHON ishlatish: kod o'zgartirilgandan keyin tasdiqlashdan oldin, yoki foydalanuvchi "tekshir", "ishlayaptimi", "test qilib ko'r", "verify" deganda.
---

# Tekshiruv — "ishladi" deyishdan oldin (CLAUDE.md #21)

Hech qachon tekshirmasdan "ishladi/bajarildi" demang. O'zgartirilgan qatlamga qarab tekshiring.

## Backend o'zgargan bo'lsa

1. Server ishlayotganini tekshiring yoki ishga tushiring:
   ```bash
   cd backend && node server.js   # port 3001
   ```
2. Endpoint'ni urib ko'ring (PowerShell):
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3001/api/<entity>?page=1&limit=5" -Method GET
   ```
   - Auth kerak bo'lsa avval `/api/auth/login` orqali token oling va `Authorization: Bearer ...` header qo'shing.
   - POST/PUT uchun `-Method POST -Body (... | ConvertTo-Json) -ContentType "application/json"`.
3. Kutilgan natija: pagination `{ data, total, page, limit }` formati, to'g'ri status kod, mijozga `e.message` oqmasligi.
4. Schema o'zgargan bo'lsa `npx prisma generate` ishlaganini tasdiqlang.

## Frontend o'zgargan bo'lsa

1. Lint:
   ```bash
   cd frontend && npm run lint
   ```
2. Dev server:
   ```bash
   cd frontend && npm run dev   # port 5173
   ```
3. Brauzerda yangi/o'zgargan sahifani oching, asosiy oqimni bajaring (ro'yxat yuklanadimi, qo'shish/tahrirlash/o'chirish ishlaydimi, toast chiqadimi, konsolda xato yo'qmi).
4. App ni real ishga tushirib ko'rish uchun `/run` yoki `/verify` skillidan ham foydalanish mumkin.

## Hisobot berish (CLAUDE.md ishonch qoidasi)

- Natijani **rost** ayting: test/endpoint xato bersa — chiqishi bilan ko'rsating.
- O'tkazib yuborilgan qadam bo'lsa "tekshirilmadi" deb aniq belgilang.
- Faqat haqiqatan ishlagan va kuzatilgan narsani "ishladi" deng — taxmin emas.

## Eslatma

Bu loyihada test suite mavjud (backend Jest, E2E Playwright — `TEXNIK_VAZIFA.md` da). Tegishli bo'lsa ularni ham ishga tushiring va natijani qayd eting.
