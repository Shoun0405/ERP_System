# UX/UI Bosqich 1 — Yagona PageShell karkasi + tuzatishlar

> Bu paket UX/UI auditning **Bosqich 1 (Tez yutuqlar)** topilmalarini real kodga tushiradi.
> Jonli prototip (oldin/keyin): `erp/PageShell Prototip.html`
> Stack: React 19 + react-router-dom + Tailwind v4 + lucide-react. Tokenlar: `frontend/src/index.css`.

---

## Bu paket nimani hal qiladi

| # | Topilma | Yechim |
| :-- | :-- | :-- |
| **F-01** | Har sahifa o'z header/filter naqshiga ega (Savdolarda `rounded-2xl` "Control Center", boshqalarda yo'q) | Yagona `PageShell` |
| **F-02** | Submenu/sort ba'zi sahifalarda bor, ba'zilarida yo'q | `PageShell` `tabs` + `sort` propslari |
| **F-03** | Sarlavha ikki joyda takror (global `TopHeader` + sahifa `<h2>`) | Sarlavha bitta manbada; header breadcrumb'ga aylanadi |
| **F-14** | Status ranglari ikki manbada: `index.css .badge-*` VA `Clients.jsx` ichidagi qotirilgan `SC` oklch obyekti | Yagona `StatusBadge` |
| **Raqam oralig'i** | `12 480 000` — `ru-RU` lokali keng probel (U+00A0) qo'yadi | `format.js` ingichka probel (U+202F) |

---

## Paket tarkibi

```
handoff/
├── components/
│   ├── PageShell.jsx      → frontend/src/components/PageShell.jsx
│   └── StatusBadge.jsx    → frontend/src/components/StatusBadge.jsx
├── lib/
│   └── format.js          → frontend/src/lib/format.js   (mavjudini almashtiradi)
├── README.md              (shu fayl)
└── CLAUDE_CODE_PROMPT.md  (Claude Code'ga paste qilinadigan topshiriq)
```

---

## 0-qadam — Branch

```bash
git checkout -b ux-ui-development
```

## 1-qadam — Raqam oralig'i (eng tez, mustaqil tuzatish)

`frontend/src/lib/format.js` ni paketdagi versiya bilan almashtiring. Faqat `fmt` va `fmtOrDash` o'zgaradi — ular natijadagi keng probelni (U+00A0) ingichka probelga (U+202F) almashtiradi. Boshqa hech narsa o'zgarmaydi, hamma sahifa avtomatik foyda oladi.

## 2-qadam — `index.css` ga karta radiusi tokeni

`:root { … }` ichiga qo'shing (radius hamma joyda bir xil bo'lishi uchun):

```css
--r-card: 12px;   /* mini-card, jadval karta — barchasi shu radius */
```

> `.dark` blokiga qo'shish shart emas — radius temaga bog'liq emas.

## 3-qadam — Komponentlarni joylang

```bash
cp handoff/components/PageShell.jsx   frontend/src/components/
cp handoff/components/StatusBadge.jsx frontend/src/components/
```

## 4-qadam — Sahifalarni PageShell'ga ko'chiring

Quyida har sahifa uchun aniq ko'rsatma. Umumiy qoida — **header + tabs + qidiruv/filtr bloklarini olib tashlab**, ularni `PageShell` propslariga uzating; jadval/forma kontenti `children` bo'lib qoladi.

> **F-03 (takror sarlavha):** `App.jsx` dagi `TopHeader` allaqachon sahifa nomini ko'rsatadi.
> Tavsiya: `TopHeader` matnini qoldiring, lekin uni kichik **breadcrumb** uslubiga o'tkazing
> (`text-xs text-[var(--text-3)]`), `PageShell` `title` esa asosiy `text-xl` sarlavha bo'lsin.
> Shunda global kontekst (header) va sahifa konteksti (PageShell) ajraladi, takror ketmaydi.

---

### 4a. Clients.jsx — namuna (eng to'liq)

Joriy: header `:315–334`, submenu tabs `:336–357`, qidiruv jadval ichida `:445–453`, sort yo'q jadval thead'da bor.

```jsx
import PageShell from '../components/PageShell';
import StatusBadge from '../components/StatusBadge';

const TABS = [
  { key:'barchasi',   label:'Barchasi' },
  { key:'qarzdorlar', label:'Qarzdorlar' },
  { key:'haqdorlar',  label:'Haqdorlar' },
  { key:'yangi',      label:'Yangi' },
];

return (
  <PageShell
    title="Mijozlar (CRM)"
    subtitle={`${total} ta mijoz`}
    actions={canCreate && (
      <>
        <button onClick={handleExport} className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm">
          <Download size={16} strokeWidth={2.2}/> Excel
        </button>
        <button onClick={openAdd} className="btn-primary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm">
          <Plus size={16} strokeWidth={2.2}/> Yangi Mijoz
        </button>
      </>
    )}
    tabs={TABS}
    activeTab={debtFilter}
    onTab={setDebtFilter}
    search={{ ...searchInput, value: search, onChange: setSearch, placeholder: 'Mijoz, STIR, telefon, sotuvchi (Enter)...' }}
  >
    {/* inline "add" form, jadval karta, modallar — o'zgarmaydi, shu yerda qoladi */}
    <div className="mini-card p-0">…</div>
  </PageShell>
);
```

> Eslatma: `useSearchOnEnter` `inputProps` (Enter bosilganda qidiradi) beradi. `PageShell` `search` proposiga oddiy `{value,onChange,placeholder}` yetarli — lekin Enter xulqini saqlash uchun `search.inputProps={searchInput}` qo'shimcha propini ham qabul qiladi (PageShell.jsx'da izoh bor). Eng oson yo'l: `search={{ value: search, onChange: ()=>{}, placeholder, inputProps: searchInput }}`.

**Status pill almashtirish** (`:494` atrofida):

```jsx
// OLDIN — qotirilgan SC obyekti:
<span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SC[c.status]||SC['Yangi']}`}>{c.status||'Yangi'}</span>
// KEYIN:
<StatusBadge status={c.status || 'Yangi'} />
```
So'ng fayl boshidagi `const SC = {…}` obyektini **o'chiring**.

---

### 4b. Products.jsx — submenu yo'q edi, qo'shiladi

Joriy: header `:163–177` (tabs yo'q). Mahsulot holati uchun `tabs` qo'shing:

```jsx
const TABS = [
  { key:'all',     label:'Hammasi' },
  { key:'low',     label:'Kam qoldiq' },
  { key:'out',     label:'Tugagan' },
];
// <PageShell title="Mahsulotlar bazasi" subtitle={`${total} ta mahsulot`} actions={…} tabs={TABS} activeTab={stockFilter} onTab={setStockFilter} search={…}>
```
Status (`Yetarli`/`Kam qoldiq`/`Tugadi`) → `<StatusBadge status={…} />`.

---

### 4c. Sales.jsx — "Control Center" rounded-2xl kartasini almashtiradi

Joriy: `:951` dagi `rounded-2xl p-5 … Control Center` ulkan karta + alohida tabs `:1011`.
Bu butun blokni `PageShell` bilan almashtiring; kaskad filtrlar (Mijoz→Shartnoma→Spetsifikatsiya) `filters` propiga o'tadi:

```jsx
<PageShell
  title="Savdolar"
  subtitle={`${total} ta yuk xati`}
  actions={canCreate && <button onClick={inlineForm.toggle} className="btn-primary …">{inlineForm.isOpen ? 'Yopish' : 'Yangi Yuk Xati'}</button>}
  tabs={SALE_TABS}
  activeTab={statusFilter}
  onTab={setStatusFilter}
  search={{ value: search, onChange: setSearch, placeholder: 'Qidirish (Enter)...', inputProps: searchInput }}
  filters={
    <>
      <select value={filterClient}   onChange={…} className="h-[38px] px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[13px]">…</select>
      <select value={filterContract} onChange={…} disabled={!filterClient}   className="…">…</select>
      <select value={filterSpec}     onChange={…} disabled={!filterContract} className="…">…</select>
      {hasFilter && <button onClick={clearFilters} className="text-xs text-red-500 font-bold flex items-center gap-0.5"><X size={13}/> Tozalash</button>}
    </>
  }
>
```
> `rounded-xl`/`rounded-2xl` select'larni `rounded-lg` (8px) ga keltiring — radius izchilligi uchun.

---

### 4d. Payments.jsx — Clients bilan bir xil naqsh

Joriy: header `:114–127`. Tabs (`Barchasi/Naqd/Bank/Karta`) qo'shing, status → `StatusBadge`. Clients namunasini takrorlang.

---

### 4e. Contracts.jsx — tabs allaqachon bor (`:1172`)

Header `:1130–1170` ni `PageShell` ga ko'chiring; mavjud tabs'ni `tabs` propiga uzating. Inline forma karta (`:782`) `children` ichida qoladi.

---

### 4f. Interactions.jsx, Users.jsx, Audit.jsx — ixtiyoriy

Bular oddiyroq. `PageShell` ga `title`/`subtitle`/`actions` bilan o'rang (tabs kerak bo'lmasligi mumkin). Konsistensiya uchun tavsiya etiladi, lekin Bosqich 1 uchun majburiy emas.

---

## Tekshirish ro'yxati (har sahifa)

- [ ] Sarlavha bitta joyda (TopHeader bilan takrorlanmaydi)
- [ ] Submenu (tabs) bor, ishlaydi, joyi bir xil
- [ ] Qidiruv + filtr/sort toolbar'da, bir xil joyda
- [ ] Karta radiusi `var(--r-card)` / `rounded-lg` — aralash `rounded-xl/2xl` yo'q
- [ ] Birlamchi tugma doim sarlavha qatorida, o'ngda
- [ ] Status `<StatusBadge>` orqali (qotirilgan oklch / `SC` obyekti yo'q)
- [ ] Raqamlar ixcham oraliqli (`fmt` ingichka probel)
- [ ] Light va dark temada to'g'ri

## Qabul mezoni (Definition of Done)

Barcha 6 ma'lumot sahifasi (Clients, Products, Sales, Payments, Contracts, + Interactions) bir xil 4 zonali tartibga ega: **Sarlavha → Submenu → Filtr/Sort → Kontent**. `console`'da xato yo'q, `npm run build` muvaffaqiyatli.
