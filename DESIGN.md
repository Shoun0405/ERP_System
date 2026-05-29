# ERP System — Claude Design Guide & UI Specification

Ushbu hujjat **Claude Design** (anthropic.com/design) va boshqa AI tizimlari loyihamiz bilan ishlashda uning dizayn tizimi, komponentlar arxitekturasi hamda vizual qoidalarini to'liq tushunishi uchun "Tizimni anglovchi" (System-Aware) manba hisoblanadi.

---

## 1. Texnologik Stack (Tech Stack)
Dizayn va foydalanuvchi interfeysini generatsiya qilishda faqat quyidagi texnologiyalar va kutubxonalardan foydalaniladi:
- **Karkas (Framework):** React 19 (ESM) + Vite
- **CSS & Stil:** Tailwind CSS v4 (Chunki Tailwind v4 `@tailwindcss/vite` plugin orqali ishlaydi, eski PostCSS yoki alohida configuration fayllariga muhtoj emas)
- **Ikonkalar:** `lucide-react` (barcha UI elementlar uchun standart ikonka to'plami)
- **Bildirishnomalar (Toasts):** `react-hot-toast` (loyihada eski alert() tizimi butunlay taqiqlangan)
- **Tillar va Valyuta:** UI to'liq **O'zbek tilida**, valyuta esa **UZS** formatida.

---

## 2. Dizayn Tizimi va Ranglar Palitrasi (Design System & Color Palette)

Claude Design tizimi bizning visual estetikamizni saqlab qolishi uchun quyidagi ranglardan foydalanadi:

| Element | Rang (HEX / Tailwind) | Vazifasi |
| :--- | :--- | :--- |
| **Sidebar Background** | `#09090b` (zinc-950) | Chap menyu fon rangi (to'liq qora emas, chuqur metall) |
| **Main Area Background** | `#fafafa` (zinc-50) | Asosiy kontent maydoni fon rangi (ko'zni charchatmaydi) |
| **Primary/Accent** | `#2563eb` (blue-600) | Aktiv tugmalar, tanlangan sahifa, asosiy aksent ranglar |
| **Success/Profit** | `#10b981` (emerald-500) | Tushumlar summasi, aktiv holatlar, muvaffaqiyatli savdolar |
| **Danger/Debt** | `#dc2626` (red-600) | Qarzdorliklar, ogohlantirishlar, o'chirish tugmalari |
| **Borders** | `#e4e4e7` (zinc-200) | Karta va jadvallarning chegaralari |
| **Text Primary** | `#09090b` (zinc-950) | Asosiy matnlar va sarlavhalar uchun |
| **Text Secondary** | `#71717a` (zinc-500) | Yordamchi matnlar va izohlar uchun |

---

## 3. Tipografiya va Matn Formatlash
- **Asosiy Shrift (Font Family):** `'Inter', sans-serif` (Vite orqali yuklanadi, silliq va professional ko'rinish beradi).
- **Raqamlarni formatlash:** Moliyaviy raqamlar doim `import { fmt } from '../lib/format'` yordamida formatlanadi.
  - Kodda to'g'ridan-to'g'ri `toLocaleString()` ishlatilmaydi, faqat `fmt(qiymat)` yoziladi.
  - Format shakli: `1 250 000 UZS` (har 3 xona probel bilan ajratiladi va yaxlitlanadi).
  - Agar sana ko'rsatilsa `fmtDate()` yoki `.toLocaleDateString('ru-RU')` ishlatiladi.

---

## 4. UI Komponentlar Standarti

### 4.1 Asosiy Karkas (Main Layout)
Loyihada sahifalar 2 ta asosiy blokdan tashkil topgan umumiy karkasga ega:
1. **Chap menyu (Sidebar):** Eni `w-60` (240px), rangi `#09090b`, to'liq balandlikda (`h-screen`). Navigatsiya elementlari hover bo'lganda `hover:bg-white/5` effektiga ega. Aktiv havola esa `bg-blue-600/15 text-blue-400` stilida.
2. **Asosiy qism:** Yuqori qismida oq rangli sarlavha paneli (`h-14 bg-white border-b border-zinc-200`), pastida esa skrol bo'luvchi kontent maydoni (`flex-1 overflow-y-auto bg-[#fafafa]`).

### 4.2 Kartalar (.mini-card)
Ma'lumotlar va statistikalar chiroyli oq kartalar ko'rinishida taqdim etiladi. CSS klassi:
```css
.mini-card {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.04);
}
```
**Animatsiya:** Har bir yangi ochilgan karta yoki ro'yxatga chiroyli mikrosekundlik paydo bo'lish effekti (`animate-in` klassi) beriladi.

### 4.3 Jadvallar (Tables)
- **Sarlavhalar (thead):** Kichik shrift `text-xs`, qalinlik `font-semibold`, kulrang `text-zinc-500`, katta harflarda `uppercase`, harflararo masofa `tracking-wider`, fon esa `@apply bg-zinc-50/50`.
- **Qatorlar (tr):** Hover bo'lganda silliq rang o'zgarishi (`hover:bg-zinc-50 transition-colors`).
- **Kataklar (td):** Chegarasi `border-b border-zinc-100`, vertikal paddinglar `py-3.5`, matn o'lchami `text-sm`.

### 4.4 Formlar va Accordion Drawer (Inline Sheets)
Loyihada yangi ma'lumot (Shartnoma, Savdo, To'lov) qo'shish uchun alohida Pop-up modal ochilmaydi. Buning o'rniga ro'yxat pastga surilib, silliq **inline accordion form** ochiladi.
- Bu maqsad uchun `frontend/src/hooks/useInlineForm.js` maxsus hooki ishlatiladi.
- Forma ochilganda ixcham, keraksiz bo'shliqlarsiz, lekin kiritish oson bo'lishi kerak.
- Dropdownlarda "Yangi mijoz qo'shish" kabi tezkor tugmalar joylashtiriladi.

### 4.5 Modallar (Modals)
Agarda biror tahrirlash (Edit) yoki tasdiqlash uchun Modal ochilishi shart bo'lsa:
- Doim `frontend/src/hooks/useModalKeys.js` hookidan foydalanish majburiy.
- Bu hook avtomatik ravishda `Ctrl + Enter` (Saqlash) va `Escape` (Yopish) tugmalarini klaviaturaga bog'laydi.

---

## 5. Claude Design orqali o'zgartirishlar kiritishda talablar

Agar siz Claude Design tizimida yangi interfeys yoki komponent yaratmoqchi bo'lsangiz, quyidagi qoidalarga qat'iy rioya qiling:
1. **Hech qachon alert() ishlatmang!** Agar biror xatolik yoki muvaffaqiyat bo'lsa, `toast.success('...')` yoki `toast.error('...')` ishlating.
2. **Vite inline imports:** Axios orqali so'rovlar yuborishda global axios emas, markazlashgan interceptorga ega `import api from '../lib/api'` dan foydalaning va faqat `api.get('/api/...')` ko'rinishida yozing.
3. **Responsive grid tizimi:** Sahifalarni minimalistik va barcha ekranlarga mos ravishda grid yoki flexbox yordamida yozing (masalan, `grid grid-cols-1 md:grid-cols-3 gap-5`).
4. **Kod tozaligi (DRY):** Har doim 3+ marta takrorlanadigan kodlarni umumiy helperlarga ajrating va CLAUDE.md yo'riqnomasidagi 20 dan ortiq tahliliy qoidalarga rioya qiling.
