# UX/UI Bosqich 2 — Tipografika + Yagona Drawer

> Bosqich 1 (PageShell) **tugagandan keyin** qo'llanadi. Bosqich 1 ga bog'liq, lekin
> mustaqil branch'da bajarilishi mumkin. Mayda kosmetik izchillik — funksiyaga tegmaydi.

---

## Bu bosqich nimani hal qiladi

| # | Topilma | Yechim |
| :-- | :-- | :-- |
| **F-05** | Matn o'lchamlari tarqoq: `text-[10px]`, `text-[10.5px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-lg` aralash; font-weight tasodifiy | 6 darajali semantik shkala (`typography.css`) |
| **F-07** | "Detalni ko'rish" har joyda boshqacha: Clients'da satr-akkordeon, Sales/Contracts'da `max-w-3xl/4xl/5xl` modal | Yagona `Drawer` + modal kengliklarini standartlash |
| **F-14+** | Status/tur ranglari 4+ joyda takror: `SC` (Clients), `TYPE_COLORS` (Interactions), `ACTION_BADGE` (Audit), rol badge (Users) | Hammasi `StatusBadge` ga |

---

## Paket tarkibi

```
handoff/phase2/
├── typography.css         → frontend/src/index.css OXIRIGA ko'chiriladi
├── Drawer.jsx             → frontend/src/components/Drawer.jsx
└── README-PHASE2.md       (shu fayl)
```
> `StatusBadge.jsx` Bosqich 1 dan keladi — bu bosqichda unga yangi status'lar qo'shiladi.

---

## A. Tipografika (F-05)

### A1 — Shkalani qo'shing
`handoff/phase2/typography.css` mazmunini `frontend/src/index.css` **oxiriga** ko'chiring. 6 daraja:

| Klass | O'lcham | Qayerda |
|---|---|---|
| `t-h1` | 20px / 600 | PageShell sahifa sarlavhasi |
| `t-h2` | 16px / 600 | Modal, karta, Drawer sarlavhasi |
| `t-body` | 13px / 400 | Jadval kataklari, forma qiymatlari |
| `t-label` | 12px / 500 | Forma label, ikkilamchi matn |
| `t-meta` | 11px / 600 UPPER | Jadval thead, bo'lim sarlavha |
| `t-caption` | 10.5px / 400 | Sana, meta izoh, "kim/qachon" |

### A2 — Ixtiyoriy o'lchamlarni almashtiring
Har sahifada `text-[10px]`, `text-[10.5px]`, `text-[11px]`, `text-lg font-bold` kabilarni
shkala klasslariga moslang (`typography.css` oxiridagi mapping jadvali bo'yicha). Rang
utility'lari (`text-[var(--text-2)]`) kerak bo'lsa qoladi.

> **Eng ko'p uchraydigan almashtirishlar:**
> - `text-lg font-bold` (modal sarlavha) → `t-h2`
> - `text-[10.5px] font-semibold … uppercase` (thead) → `t-meta`
> - `text-[10px] text-[var(--text-3)]` (meta) → `t-caption`
> - `text-xs` (tana) → `t-body`

---

## B. Yagona Drawer (F-07)

### B1 — Komponentni joylang
```bash
cp handoff/phase2/Drawer.jsx frontend/src/components/
```

### B2 — Detal ko'rinishlarini Drawer'ga o'tkazing
**Faqat "ko'rish" (read-only detal)** stsenariylari:
- **Clients.jsx** — satr ichidagi akkordeon (rekvizitlar + shartnomalar) → `Drawer width="lg"`.
  Satrni bosganda `Drawer` ochiladi; jadval sakramaydi, kontekst yo'qolmaydi.
- **Sales.jsx** — `detail` modal (`max-w-3xl`) → `Drawer width="lg"`.
- **Contracts.jsx** — detal modal (`max-w-4xl`) → `Drawer width="lg"`.

```jsx
import Drawer from '../components/Drawer';

<Drawer
  open={!!detail}
  onClose={() => setDetail(null)}
  title={detail?.name}
  subtitle={`Yuk xati №${detail?.nakladnoy}`}
  width="lg"
  footer={<button onClick={…} className="btn-primary px-4 py-2 rounded-lg t-label">Chop etish</button>}
>
  {/* detal kontenti — avvalgi modal ichidagi narsa */}
</Drawer>
```

### B3 — Forma/tasdiq modallarini standartlang
**Forma va tasdiq** uchun modal qoladi, lekin kenglik 3 ta standartga keltiriladi:

| Maqsad | Kenglik |
|---|---|
| Tasdiq dialogi (o'chirish) | `max-w-sm` |
| Oddiy forma | `max-w-md` |
| Keng / ko'p ustunli forma | `max-w-2xl` |

`max-w-lg`, `max-w-3xl`, `max-w-4xl`, `max-w-5xl` — yuqoridagilarga moslang (detal modallar Drawer'ga ketgani uchun kengi kerak emas).

---

## C. Status/tur xaritalarini birlashtiring (F-14 davomi)

Bu joylardagi qotirilgan rang obyektlarini **o'chirib**, `StatusBadge` ga o'tkazing:

| Fayl | O'chiriladigan obyekt | O'rniga |
|---|---|---|
| Clients.jsx | `SC` | `<StatusBadge status={…}/>` (Bosqich 1 da bajarilgan) |
| Interactions.jsx | `TYPE_COLORS` | `<StatusBadge status={it.type}/>` |
| Audit.jsx | `ACTION_BADGE` | `<StatusBadge status={r.action}/>` |
| Users.jsx | rol badge inline klasslar | `<StatusBadge status={role}/>` |

Yangi status/tur qiymatlari uchun `StatusBadge.jsx` ichidagi `STATUS_TONE` xaritasiga
qator qo'shing (masalan `'Qo'ng'iroq': 'info'`, `'admin': 'bad'`). Bitta manba.

---

## Tekshirish ro'yxati

- [ ] Hech bir sahifada `text-[10px]`/`text-[11px]`/`text-lg font-bold` qolmagan (shkala klasslari)
- [ ] Detal ko'rish doim Drawer (o'ngdan), forma/tasdiq modal
- [ ] Modal kengliklari faqat `sm`/`md`/`2xl`
- [ ] `SC`/`TYPE_COLORS`/`ACTION_BADGE`/rol-badge obyektlari o'chirilgan
- [ ] Light + dark temada to'g'ri, `npm run build` xatosiz
