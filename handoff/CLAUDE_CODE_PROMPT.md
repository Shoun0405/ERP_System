# Claude Code topshirig'i — UX/UI Bosqich 1

> Quyidagini Claude Code'ga (loyiha ildizida ishga tushirilgan) to'liq paste qiling.
> Oldindan: `handoff/` papkasini repo ildiziga ko'chirib qo'ying (yoki shu fayllar mavjud bo'lsin).

---

```
Sen ERP loyihasining UX/UI izchilligini yaxshilayapsan. Stack: React 19 +
react-router-dom + Tailwind v4 + lucide-react. Dizayn tokenlari
frontend/src/index.css ichida CSS o'zgaruvchilar sifatida (--text, --surface,
--border, --accent, --r-card, ...). Yangi rang YARATMA — faqat shu tokenlardan foydalan.

To'liq spetsifikatsiya: handoff/README.md. Tayyor komponentlar: handoff/components/.
Avval ikkalasini ham o'qib chiq.

VAZIFA (tartib bilan bajaramiz, har qadamdan keyin to'xtab tasdiq so'ra):

1. Branch: `ux-ui-development` da ishla (mavjud bo'lmasa yarat).

2. RAQAM ORALIG'I: frontend/src/lib/format.js ni handoff/lib/format.js bilan
   almashtir. (fmt/fmtOrDash natijasidagi U+00A0 keng probelni U+202F ingichka
   probelga almashtiradi — "12 480 000" ixchamlashadi.) Faqat shu fayl.

3. TOKEN: frontend/src/index.css ichidagi :root blokiga `--r-card: 12px;` qo'sh.

4. KOMPONENTLAR: handoff/components/PageShell.jsx va StatusBadge.jsx ni
   frontend/src/components/ ga ko'chir.

5. SAHIFALARNI KO'CHIR — handoff/README.md "4-qadam" bo'limidagi aniq ko'rsatmaga
   amal qilib, har birini ALOHIDA commit qil, shu tartibda:
     a) Clients.jsx   (namuna — SC obyektini o'chir, StatusBadge ishlat)
     b) Payments.jsx
     c) Products.jsx  (yangi submenu tabs qo'sh)
     d) Contracts.jsx (mavjud tabs'ni PageShell'ga uzat)
     e) Sales.jsx     (rounded-2xl "Control Center" kartasini PageShell bilan almashtir)

   Har sahifada:
     - Sarlavha/header bloki, submenu tabs, qidiruv/filtr bloklarini PageShell
       propslariga ko'chir; jadval/forma/modal kontenti children bo'lib qoladi.
     - State (debtFilter, statusFilter, search, ...), API chaqiruvlari, modallar,
       ruxsat (canCreate/canUpdate/...) mantig'iga TEGMA — faqat layoutni qayta o'ra.
     - Status pill'larni <StatusBadge status={...}/> bilan almashtir; qotirilgan
       oklch/SC obyektlarini o'chir.
     - Aralash radiuslarni (rounded-xl/2xl) rounded-lg yoki var(--r-card) ga keltir.

6. F-03 (takror sarlavha): App.jsx dagi TopHeader sahifa nomini ko'rsatadi.
   Uni kichik breadcrumb uslubiga o'tkaz (text-xs text-[var(--text-3)]), PageShell
   title esa asosiy text-xl sarlavha bo'lsin. Takror bo'lmasin.

QOIDALAR:
- Funksionallikni buzma: qidiruv, sort, filtr, pagination, CRUD, ruxsatlar avvalgidek ishlasin.
- Har qadamdan keyin `npm run build` ni tekshir, konsol xatosiz bo'lsin.
- Light va dark temada vizual tekshir.
- Backend, API shartnomalari, DB sxemasiga TEGMA — bu faqat frontend layout ishi.
- handoff/README.md oxiridagi "Tekshirish ro'yxati" bo'yicha har sahifani tasdiqla.

Boshlashdan oldin: handoff/README.md ni o'qib, qisqacha reja taqdim et va 1-2-qadamdan boshla.
```

---

### Eslatma

- Paket faqat **frontend layout** ni o'zgartiradi — biznes-mantiq, API, DB tegmaydi.
- Har sahifa alohida commit bo'lgani uchun, biror sahifada muammo chiqsa oson orqaga qaytariladi.
- Sales.jsx eng murakkab (kaskad filtrlar) — uni oxirida qilish tavsiya etiladi.

---

## Bosqich 2 topshirig'i (Bosqich 1 TUGAGANDAN keyin)

> Alohida branch: `ux-ui-typography`. Spetsifikatsiya: `handoff/phase2/README-PHASE2.md`.
> Quyidagini paste qiling:

```
Sen ERP loyihasida UX/UI izchilligini davom ettiryapsan (Bosqich 2). Bosqich 1
(PageShell + StatusBadge) allaqachon bajarilgan. Faqat frontend layout/stil —
biznes-mantiq, API, DB tegmaydi. Tokenlar: frontend/src/index.css.

To'liq spetsifikatsiya: handoff/phase2/README-PHASE2.md — avval o'qib chiq.

Branch: `ux-ui-typography` da ishla.

VAZIFA (har qadamdan keyin to'xtab tasdiq so'ra, alohida commit):

1. TIPOGRAFIKA: handoff/phase2/typography.css ni frontend/src/index.css OXIRIGA
   ko'chir (6 darajali shkala). So'ng har sahifadagi ixtiyoriy o'lchamlarni
   (text-[10px], text-[10.5px], text-[11px], text-lg font-bold, text-xs, text-sm)
   typography.css oxiridagi mapping bo'yicha t-h1/t-h2/t-body/t-label/t-meta/
   t-caption klasslariga almashtir. Rang utility'larini kerak bo'lsa qoldir.
   Sahifalarni bittalab qil: Clients → Payments → Products → Contracts → Sales →
   Interactions → Users → Audit → Reports.

2. DRAWER: handoff/phase2/Drawer.jsx ni frontend/src/components/ ga ko'chir.
   "Detalni ko'rish" stsenariylarini Drawer'ga o'tkaz:
     - Clients.jsx satr-akkordeon → Drawer width="lg"
     - Sales.jsx detail modal (max-w-3xl) → Drawer width="lg"
     - Contracts.jsx detal modal (max-w-4xl) → Drawer width="lg"
   Forma/tasdiq modallari MODAL bo'lib qoladi, lekin kengliklarni 3 standartga
   keltir: tasdiq=max-w-sm, forma=max-w-md, keng forma=max-w-2xl. max-w-lg/3xl/
   4xl/5xl ni shularga moslang.

3. STATUS XARITALARINI BIRLASHTIR: quyidagi qotirilgan obyektlarni o'chir va
   <StatusBadge status={...}/> ishlat:
     - Interactions.jsx → TYPE_COLORS
     - Audit.jsx → ACTION_BADGE
     - Users.jsx → rol badge inline klasslar
   Yangi qiymatlar uchun StatusBadge.jsx ichidagi STATUS_TONE'ga qator qo'sh
   (allaqachon qo'shilganlari bor).

QOIDALAR:
- Funksionallikni buzma; faqat stil/layout.
- Har qadam: npm run build xatosiz, light+dark tema tekshir.
- README-PHASE2.md oxiridagi tekshirish ro'yxati bo'yicha tasdiqla.

Boshla: README-PHASE2.md ni o'qib qisqacha reja ber, 1-qadamdan boshla.
```

