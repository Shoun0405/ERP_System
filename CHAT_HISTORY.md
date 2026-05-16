# Sessiya — 2026-05-16 | Foydalanuvchi xabarlari

---

**1.**
@CLAUDE.md @TEXNIK_VAZIFA.md ushbu fayllar va butun dasturim asosida dasturning hozirgi holatini analiz qil va tahlil yoz. Shular asosida PRD tayyorla. PRD da hammasi aniq va ravshan bo'lsin, step-by-step guide ham bo'lsin. Keyin uni ko'rib qo'shadigan istaklarim bo'lsa qo'shaman. barcha planlashtirishni Opus bilan qil, amalga oshirishni Sonnet bilan qil.

---

**2.**
yaxshi, faqat qo'shadigan narsalar mavjud. Bularni PRD ga qo'sh va muvofiqlashtir:

1. shartnomalar bo'limi qo'shilishi kerak. Unda quidagi funksionallar bo'lishi lozim:
- shartnomalar ro'yxati ko'rinib turadi, tartib raqam, mijoz, inn, shartnoma raqami, shartnoma sanasi, shartnoma umumiy summasi, Payments (shartnoma bo'yicha tushgan mablag'lar), Delivered (shartnoma bo'yicha yetkazib berilgan mahsulotlar summasi), Spetsifikatsiyalar (shartnoma bo'yicha qilingan spetsifikatsiyalar soni), Faktura (shartnoma bo'yicha berilgan fakturalar summsi), Status (shartnoma holati - yangi, amalda, yopilgan). Shartnomani ustiga bosganda unga biriktirilgan spetsifikatsiya (bundan keyin - spets) lar ro'yxati dropdownga ochilib barcha spetslar ko'rinib turishi kerak, unda spets nomeri, sanasi, summasi, spets bo'yicha Delivered . Spetsifikatsiyani o'zgartirish, qo'shish, o'chirish uchun 3ta nuqta funksiyasi bo'lishi kerak, va spets orqali savdo yaratish uchun tugma bo'lishi lozim, uni bosganda shu spets asosida yangi savdo yaratiladi;
- shartnomalarni CRUD qilish mumkin bo'ladi;
- yangi sharnoma qo'shishda mijozlar dropdown orqali tanlanadi, agar kerakli mijoz bo'lmasa dropdownda qo'shish tugmasi ham bo'lishi kerak;
- shartnoma qo'shish tugmasi bosilganda yangi pop-up oyna ochilishi kerak emas, shunchaki shartnomalar ro'yxati pastga tushib shartnoma form to'ldirish blanki paydo bo'lishi zarur. Blank katta bo'lishi kerak emas, ixcham bo'lishi maqsadga muvofiq;
- Shartnoma form ida mijoz, inn si, shartnoma raqami (tizimda avtomatik nomerlash funksiyasi bo'lishi kerak, admin nastroykadan uni o'chirishi yoki yoqishi mumkin bo'lsin, shartnoma raqami formulasi quidagicha - 26-01 ya'ni 2026 yildagi 01 chi shartnoma; avtomatik nomerlashda o'chirilgan shartnoma raqami hisoblanmasligi kerak), shartnoma sanasi (avtomatik bugungi sana chiqib turishi kerak, o'zgartirish imkoniyati bo'lsin), shartnoma umumiy summasi, va izoh uchun uzun joy. Oxirida spetsifikatsiya qo'shish tugmasi ham bo'lishi kerak, uni bosganda mahsulotlarni tanlab qo'shish imkoni bo'lishi kerak. Dropdown (shu yerda barchasini qo'shish tugmasi ham bo'lishi kerak) orqali mahsulot qo'shilganda uni nomi, xarakteristikalari, o'lchov birligi (kv.m. - kub.m. - kg = bo'lishi mumkin), soni, birlik qiymat uchun narxi (qo'lda yoziladi) QQS bilan, QQS qiymati - 12% (Jami summa/1.12*.12), Jami summa. Shunday qilib mahsulotlarni istagancha qo'shish imkoni bo'lishi lozim , va jami summani oxirida hisoblashi kerak.
- shartnoma form i to'ldirilgandan so'ng saqlash bosiladi va shartnoma yaratiladi, uni yuklab olish, o'chirish, o'zgartirish uchun tugmalar bo'lshi kerak, shartnomani pdf yoki excel shaklida yuklab olish imkoni bo'lishi lozim, shunda pdf birinchi sahifasida sharnoma, ikkinchisida spetsifikatsiya bo'lishi kerak. Spetsifikatsiya har bir shartnoma uchun alohida numeratsiya bilan boshlanadi, bitta shartnoma uchun istalgancha spetsifikatsiya bo'lishi mumkin, nomerlash tizim orqali amalga oshiriladi.

2. Savdolar bo'limi ham shartnomalarga o'xshab ishlashi kerak, ya'ni yangi savdo dropdown ga o'xshab qo'shiladi, yangi oyna ochilmaydi. Savdolar ro'yxatida, qaysi spets va shartnoma bo'yicha yetkazib berilganligi ko'rinib turishi kerak.

3. Qilingan o'zgarishlar bo'yicha meni fikrim so'ralishi lozim, yana qandaydur funksional qo'shmoqchi bo'lsam oson qo'shishning imkoni bo'lishi kerak. Ya'ni butun kodni ostin-ustin qilmasdan funksional qo'shish mumkin bo'lsin.

---

**3.**
14b dan boshlaymiz

---

**4.**
menda ishlamayapti localhost

---

**5.**
*(Screenshot)* — shartnoma yaratildi deyapti lekin shartnoma ko'rinmayapti

---

**6.**
nega shartnomalarda spetsifikatsiya qo'shish imkoni yaratilmagan

---

**7.**
*(Screenshot)* — ustunlar muvofiq emas, ancha uzoqda turibdi, tekkisla

---

**8.**
*(Screenshot)* — 3 nuqtani bosganda funksional oynacha ko'rinmay qolyapti, shartnomalar borderini ichida qolib ketyapti, shuni tashqarida chiqadigan qil, borderni ichida qolib ketmasin

---

**9.**
*(Screenshot)* — yangi shartnoma qo'shilganda avtomatik pastga qo'shilyapti, shartnomalar avtomatik oxirgi yaratilgani bo'yicha sort bo'lishi kerak. Shuningdek barcha parametrlar bo'yicha sort qilishning imkoni bo'lishi kerak. Inn bir xil formada bo'lishi kerak, 3ta sondan keyingi oraliq bir oz sezilarli bo'lishi kifoya, katta ochiq bo'lishi kerak emas.

---

**10.**
yaxshi keyingi bosqichga o't

---

**11.**
*(Screenshot)* — spets dan savdo yaratish bosilganda savdo bo'limiga o'tishi va spetsga ko'ra yangi savdo hosil qilishi kerak.

---

**12.**
senga bugungi sessiya uchun bash va powershell uchun barcha ruxsatni beraman, mendan qayta ruxsat so'rama

---

**13.**
shu chatda senga yozganlarimni md fayl qilib ber
