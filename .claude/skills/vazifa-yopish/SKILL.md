---
name: vazifa-yopish
description: Bosqich/feature tugaganda TEXNIK_VAZIFA.md ish jurnalini yangilash — "Joriy holat" sanasini bugungiga, bajarilgan ishni qisqa qayd qilish, tegishli bosqich statusini TODO → DONE ✅ ga o'tkazish. QACHON ishlatish: foydalanuvchi bosqichni/vazifani "tugatdik", "yopdik", "TEXNIK_VAZIFA ni yangila", yoki biror ish bitgach jurnalga yozishni so'raganda.
---

# TEXNIK_VAZIFA.md yangilash (CLAUDE.md #23)

Har bir bosqich/feature tugaganda ish jurnali yangilanishi shart. Faqat haqiqatan bajarilgan va **tekshirilgan** ishni qayd qiling (#21).

## Qadamlar

1. **O'qing.** `TEXNIK_VAZIFA.md` ni o'qing — ayniqsa yuqoridagi "Joriy holat" bloki va tegishli bosqich bo'limi.

2. **Bugungi sana.** Joriy sanani memory'dagi `currentDate` dan yoki foydalanuvchidan oling. "Joriy holat (oxirgi yangilanish: YYYY-MM-DD)" sarlavhasini bugungiga yangilang.

3. **"Joriy holat" ga qo'shing.** Yangi bir qator:
   `**Bajarildi (YYYY-MM-DD):** <qisqa, aniq nima qilingani — qaysi fayllar/qaysi muammo yopilgani>.`
   - Test bor bo'lsa natijani yozing (masalan "Test suite: 86/86 o'tdi").
   - "Keyingi qadam:" qatorini yangilang — endi nima qilinishi kerakligini ko'rsating.

4. **Bosqich statusini o'zgartiring.** Tegishli "### Bosqich N" bo'limida:
   - `**Holat: TODO**` → `**Holat: DONE ✅**`
   - Checklist bandlarini `- [ ]` → `- [x]` qiling.

5. **Uslubni saqlang.** Mavjud yozuvlar uslubiga moslang (o'zbekcha, qisqa, fayl nomlari backtick ichida). Ortiqcha izoh yozmang — koddan ko'rinadigan narsani takrorlamang (#18).

## Muhim

- **Haqiqatni yozing** (CLAUDE.md ishonch qoidasi): test o'tmagan bo'lsa "o'tdi" deb yozmang; o'tkazib yuborilgan qadam bo'lsa shuni qayd qiling. Tugamagan ishni DONE qilmang.
- Sanalarni absolyut yozing (nisbiy "kecha/bugun" emas), jurnal tarix uchun.
- Faqat `TEXNIK_VAZIFA.md` ni tahrirlang — bu skill kod o'zgartirmaydi.
