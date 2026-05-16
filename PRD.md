# PRD — ERP System (Textile/Building Materials Trading)

**Versiya:** 2.1 → 3.0 Roadmap (Bosqich 14 + 14b + 14c qo'shildi)
**Sana:** 2026-05-16
**Status:** Bosqich 14b (Contracts moduli) va 14c (Sales inline) BAJARILDI ✅ — Keyingi: Bosqich 14 (JWT Authentication)

---

## 1. Executive Summary

### 1.1 Loyiha maqsadi
ERP System — to'qimachilik va qurilish materiallari savdosi bilan shug'ullanuvchi O'zbekiston kompaniyalari uchun mo'ljallangan full-stack ERP yechimi. Tizim mijozlar bazasi (CRM), mahsulot katalogi (multi-unit pricing — ton/cbm/sqm), shartnomalar, yuk xatlari (nakladnoylar), to'lov tushumlari va dashboard analitikasini bir markazda birlashtiradi. UI O'zbek tilida, valyuta UZS, hisobotlar Rus locale (`ru-RU`) raqam formatida.

### 1.2 Hozirgi holat (2026-05-16)
**Versiya 2.1 — Production Ready (LAN deployment).**
- 13 ta bosqich yakunlangan: PostgreSQL migratsiya, route splitting, Zod validatsiya, pagination, security middleware, toast UX, test suite, idempotent import, contracts/interactions to'liq CRUD, DRY helper kutubxonasi.
- 5-20 ta concurrent foydalanuvchi LAN tarmog'ida ishlay oladi.
- PM2 + same-origin static serve (bitta port 3001) production deployment patterni.
- Vitest + Supertest + Playwright e2e bilan test coverage.

### 1.3 Keyingi bosqich
**Bosqich 14 — JWT Authentication (P0, kritik).** Hozir tarmoqdagi har qanday qurilma ERP ga to'liq kirish huquqiga ega. Bu eng katta xavfsizlik tirqishi. Bosqich 14 dan keyin foydalanuvchi/rol/audit infrastruktura ochilib, keyingi bosqichlar (RBAC, reporting, mobile) shu poydevor ustiga quriladi.

---

## 2. Current State Analysis

### 2.1 Bajarilgan ish (Bosqichlar 1-13)

| Bosqich | Mavzu | Asosiy yutuq |
|---------|-------|--------------|
| 1 | DB migration | SQLite → PostgreSQL, `connection_limit=20` |
| 2 | Schema constraints | Unique indekslar (inn, article, [number,clientId]), FK indekslar |
| 3 | Route splitting | `server.js` 492→15 qator, 8 ta route fayl |
| 4 | Dashboard SQL | `$queryRaw` aggregation, N+1 yo'q |
| 5 | Sale transactions | `prisma.$transaction` + Zod |
| 6 | Frontend refactor | `VITE_API_URL`, shared axios, visibility-aware polling |
| 7 | Idempotent import | `upsert` pattern, FK `null` |
| 8 | Performance | Pagination barcha listlarda, debounce, compression |
| 9 | Security | Markazlashgan Zod (`_schemas.js`), CORS, helmet, rate-limit, error middleware |
| 10 | UX | `react-hot-toast` (alert o'lgan), print, XLSX export, Interactions UI |
| 11 | Production hardening | PM2, morgan, health endpoint, backup script, same-origin |
| 12 | Tests & monitoring | Vitest, Supertest, Playwright, uptime check, Sentry placeholder |
| 13 | Yarim feature yakuni | Contracts/Interactions PUT/DELETE, DRY (`lib/format.js`) |

### 2.2 Bajarilmagan kamchiliklar (gaps)

| # | Kamchilik | Ta'sir | Priority |
|---|-----------|--------|----------|
| 1 | Autentifikatsiya yo'q | Tarmoqdagi har kim ma'lumotni o'chirishi mumkin | **P0** |
| 2 | Foydalanuvchi modeli yo'q | Kim kim ekani noma'lum | **P0** |
| 3 | Audit trail yo'q | Kim qanday amal qilganini bilib bo'lmaydi | **P1** |
| 4 | RBAC yo'q | Sotuvchi ham admin ham bir xil huquq | **P1** |
| 5 | PDF hisobot yo'q | Faqat ekranga chop etish (print dialog) | **P2** |
| 6 | Mobile responsive emas | Desktop-only, telefonda buzilgan | **P2** |
| 7 | Real-time yo'q | Polling 30s — WebSocket / SSE yo'q | **P3** |
| 8 | Backup recovery test qilinmagan | `pg_dump` bor lekin restore drill yo'q | **P2** |

### 2.3 Technical debt

- **`Setting.data` — JSON blob string.** Type-safety yo'q, Zod parse `settings.js` ga bog'langan.
- **`isFromExcel: Boolean`** — import.js artefakti, vaqt o'tishi bilan ahamiyatini yo'qotadi.
- **`fmt()` `App.jsx` da emas, `lib/format.js` da.** `CLAUDE.md` eskirgan — yangilash kerak.
- **Frontend hali ham `Dashboard` ni `App.jsx` da ushlab turibdi** — `pages/Dashboard.jsx` ga ko'chirish DRY uchun foydali.

---

## 3. PRD — Bosqich 14: JWT Authentication (P0)

### 3.1 Maqsad
Tizimga login/parol orqali kirish majburiy bo'lsin. Token 7 kun amal qilsin. Barcha `/api/*` endpointlar himoyalanmagan `/api/health` va `/api/auth/login` dan tashqari token talab qilsin. Frontend `localStorage` da token saqlasin, 401 da avtomatik logout.

### 3.2 Acceptance criteria

- [ ] Hech qaysi business endpoint (clients, sales, etc.) tokensiz javob bermaydi (`401`).
- [ ] Login muvaffaqiyatli bo'lganda token + user obyekti qaytadi.
- [ ] Token muddati o'tgan bo'lsa, frontend avtomatik login sahifaga yo'naltiradi.
- [ ] `passwordHash` bcrypt orqali saqlanadi (cost factor 10).
- [ ] `JWT_SECRET` `.env` da, kamida 32 byte random.
- [ ] Birinchi admin user `scripts/seed-users.js` orqali yaratiladi.
- [ ] Existing test suite ishga tushadigan tarzda yangilanadi (auth helper qo'shiladi).

### 3.3 Schema o'zgarishlar

**`backend/prisma/schema.prisma` ga qo'shing:**

```prisma
model User {
  id           String    @id @default(uuid())
  username     String    @unique
  passwordHash String
  fullName     String
  role         String    @default("seller")  // "admin" | "seller"
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([username])
  @@index([role])
}
```

**Buyruqlar:**
```powershell
cd backend
npx prisma db push
npx prisma generate
```

### 3.4 Backend — step-by-step

#### Step 14.1 — Dependencies
```powershell
cd backend
npm install bcryptjs jsonwebtoken
```

#### Step 14.2 — `.env` ga qo'shing
```
JWT_SECRET=<openssl rand -hex 32 chiqishidan oling, kamida 64 hex char>
JWT_EXPIRES_IN=7d
```

`.env.example` ga ham `JWT_SECRET=` placeholder qo'shing.

#### Step 14.3 — `backend/lib/auth.js` (yangi fayl)
```js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET .env da yo\'q yoki juda qisqa (>= 32 char kerak)');
}

const hashPassword   = (pwd) => bcrypt.hash(pwd, 10);
const verifyPassword = (pwd, hash) => bcrypt.compare(pwd, hash);

const signToken = (user) => jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  SECRET,
  { expiresIn: EXPIRES }
);

const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
```

#### Step 14.4 — `backend/middleware/authMiddleware.js` (yangi fayl)
```js
const { verifyToken } = require('../lib/auth');
const prisma = require('../prisma');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token yo\'q' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, fullName: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Foydalanuvchi faol emas' });
    }
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token muddati tugagan' });
    }
    return res.status(401).json({ error: 'Token noto\'g\'ri' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Auth talab qilinadi' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ruxsat etilmagan' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

#### Step 14.5 — `backend/routes/_schemas.js` ga qo'shing
```js
const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

const userCreateSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-z0-9_]+$/i, 'Faqat harf/raqam/_'),
  password: z.string().min(6).max(200),
  fullName: z.string().min(1).max(200),
  role:     z.enum(['admin', 'seller']).default('seller'),
  isActive: z.boolean().default(true),
});

const userUpdateSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  password: z.string().min(6).max(200).optional(),
  role:     z.enum(['admin', 'seller']).optional(),
  isActive: z.boolean().optional(),
});

// module.exports ga qo'shing:
// loginSchema, userCreateSchema, userUpdateSchema
```

#### Step 14.6 — `backend/routes/auth.js` (yangi fayl)
```js
const router = require('express').Router();
const prisma = require('../prisma');
const { verifyPassword, signToken } = require('../lib/auth');
const { loginSchema } = require('./_schemas');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireAuth, (req, res) => {
  res.json({ success: true });
});

module.exports = router;
```

#### Step 14.7 — `backend/app.js` yangilash

Mavjud `app.use('/api/...')` qatorlarini quyidagicha almashtiring:

```js
const { requireAuth } = require('./middleware/authMiddleware');

// Himoyalanmagan (token talab qilmaydi)
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/health', require('./routes/health'));

// Himoyalangan (token majburiy)
app.use('/api/clients',      requireAuth, require('./routes/clients'));
app.use('/api/products',     requireAuth, require('./routes/products'));
app.use('/api/contracts',    requireAuth, require('./routes/contracts'));
app.use('/api/sales',        requireAuth, require('./routes/sales'));
app.use('/api/payments',     requireAuth, require('./routes/payments'));
app.use('/api/interactions', requireAuth, require('./routes/interactions'));
app.use('/api/dashboard',    requireAuth, require('./routes/dashboard'));
app.use('/api/settings',     requireAuth, require('./routes/settings'));
```

#### Step 14.8 — `backend/scripts/seed-users.js` (yangi fayl)
```js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../prisma');
const { hashPassword } = require('../lib/auth');

async function main() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'Admin123!';
  const fullName = process.argv[4] || 'System Administrator';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Foydalanuvchi "${username}" allaqachon mavjud.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, fullName, role: 'admin', isActive: true },
  });

  console.log('Admin yaratildi:');
  console.log(`  username: ${user.username}`);
  console.log(`  password: ${password}  <- BIRINCHI LOGIN DAN KEYIN O'ZGARTIRING!`);
}

main().finally(() => prisma.$disconnect());
```

**Ishga tushirish:**
```powershell
cd backend
node scripts/seed-users.js admin Admin123! "Bosh administrator"
```

#### Step 14.9 — Test helper: `backend/tests/helpers/auth.js` (yangi fayl)
```js
const { signToken, hashPassword } = require('../../lib/auth');
const prisma = require('../../prisma');

async function createTestUser(role = 'admin') {
  const username = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword('test1234'),
      fullName: 'Test User',
      role,
      isActive: true,
    },
  });
  return { user, token: signToken(user) };
}

module.exports = { createTestUser };
```

Mavjud testlarga har bir `supertest` chaqiruvida `Authorization: Bearer ${token}` header qo'shing.

### 3.5 Frontend — step-by-step

#### Step 14.10 — `frontend/src/lib/auth.js` (yangi fayl)
```js
const TOKEN_KEY = 'erp_token';
const USER_KEY  = 'erp_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser  = () => {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
};

export const setAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => !!getToken();
```

#### Step 14.11 — `frontend/src/lib/api.js` yangilash
```js
import axios from 'axios';
import toast from 'react-hot-toast';
import { getToken, clearAuth } from './auth';

export const API = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ baseURL: API });

// Request interceptor — Bearer token qo'shish
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — 401 da logout
api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const msg    = err.response?.data?.error || err.message || 'Server xatosi';

    if (status === 401) {
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Sessiya tugagan'));
    }

    toast.error(msg);
    return Promise.reject(new Error(msg));
  }
);

export default api;
```

#### Step 14.12 — `frontend/src/pages/Login.jsx` (yangi fayl)
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { setAuth } from '../lib/auth';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Maydonlar bo\'sh');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      setAuth(data.token, data.user);
      toast.success(`Xush kelibsiz, ${data.user.fullName}`);
      navigate('/', { replace: true });
    } catch {
      // interceptor toast ko'rsatadi
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <form onSubmit={submit} className="w-full max-w-sm p-8 bg-white rounded-xl shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto bg-blue-600 rounded-xl flex items-center justify-center">
            <LogIn size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">ERP System</h1>
          <p className="text-sm text-zinc-500">Tizimga kirish</p>
        </div>
        <div className="space-y-3">
          <input
            type="text" placeholder="Login" value={username}
            onChange={e => setUsername(e.target.value)} autoFocus
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          <input
            type="password" placeholder="Parol" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium text-sm transition">
          {loading ? 'Tekshirilmoqda...' : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
```

#### Step 14.13 — `frontend/src/components/PrivateRoute.jsx` (yangi fayl)
```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

export default function PrivateRoute({ children }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
```

#### Step 14.14 — `frontend/src/App.jsx` yangilash

App.jsx da quyidagi o'zgarishlar:
1. `Login` va `PrivateRoute` import qiling.
2. `getUser`, `clearAuth` import qiling `../lib/auth` dan.
3. `TopHeader` da user info + logout tugmasi qo'shing.
4. `Routes` ni `Layout` komponentiga ajrating.
5. Root route ni `PrivateRoute` bilan o'rang.

```jsx
// App.jsx strukturasi (qisqacha)
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import { getUser, clearAuth } from './lib/auth';
import { LogOut } from 'lucide-react';

// TopHeader ichida logout:
const user = getUser();
const logout = () => { clearAuth(); navigate('/login', { replace: true }); };

// Routes:
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/*" element={
    <PrivateRoute>
      <Layout />
    </PrivateRoute>
  } />
</Routes>
```

### 3.6 Bosqich 14 — tekshirish

```powershell
# 1. Schema yangilash
cd backend
npx prisma db push
npx prisma generate

# 2. Admin seed
node scripts/seed-users.js admin Admin123!

# 3. Backend ishga tushirish
node server.js

# 4. Health — tokensiz (ishlashi kerak)
curl http://localhost:3001/api/health
# Kutilgan: {"status":"ok"}

# 5. Clients — tokensiz (401 bo'lishi kerak)
curl http://localhost:3001/api/clients
# Kutilgan: {"error":"Token yo'q"}

# 6. Login
curl -X POST http://localhost:3001/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"Admin123!"}'
# Kutilgan: {"token":"eyJ...","user":{...}}

# 7. Clients — token bilan (200 bo'lishi kerak)
curl http://localhost:3001/api/clients `
  -H "Authorization: Bearer <token>"
# Kutilgan: {"data":[...],"total":N}
```

Frontend tekshirish:
1. `npm run dev` → `/login` sahifaga avtomatik yo'naltirilishi kerak.
2. `admin`/`Admin123!` bilan kirish → Dashboard ochilishi kerak.
3. `localStorage` da `erp_token`, `erp_user` borligini tekshiring.
4. `localStorage.setItem('erp_token', 'broken')` → sahifa yangilansa `/login` ga qaytishi kerak.

### 3.7 Estimated effort
- Backend: 4-6 soat
- Frontend: 3-4 soat
- Test/QA: 2 soat
- **Jami: ~1 ish kuni (8-12 soat)**

---

## 3A. PRD — Bosqich 14b: Shartnomalar moduli (Schema + Backend + Frontend + Export)

> **Priority:** P0 (Bosqich 14 — JWT bilan parallel ishlash mumkin, lekin auth tugagandan keyin merge qilish tavsiya etiladi)
> **Estimated effort:** ~3-4 ish kun
> **Boshlash sharti:** Bosqich 14 (JWT) tugashi yoki paralleldagi feature branchda ishlatish

### 3A.1 Maqsad

Mavjud sodda `Contract` modelini to'liq biznes-modulga aylantirish. Foydalanuvchi har bir shartnoma ostida bir nechta **Spetsifikatsiya** (Spec) yaratadi, har bir Spec ichida bir nechta mahsulot qatorlari bo'ladi (QQS hisobi bilan). Savdolar (`Sale`) endi shartnomaga emas, balki **konkret Spetsifikatsiyaga** bog'lanadi. Shartnomalar ro'yxati to'liq aggregate ma'lumot ko'rsatadi: tushgan to'lovlar, yetkazilgan mahsulotlar, spetslar soni, fakturalar va status. Yangi shartnoma qo'shish **inline accordion forma** (popup emas) orqali amalga oshiriladi. Shartnoma PDF (2 sahifa) va Excel (2 sheet) sifatida eksport qilinadi.

### 3A.2 Foydalanuvchi hikoyalari (User Stories)

1. **Menejer sifatida** men shartnomalar ro'yxatida har bir shartnoma uchun jami summa, tushgan to'lov, yetkazilgan mahsulot va spetslar sonini bir qatorda ko'rishni xohlayman, shunda men qarz balansi va bajarilish darajasini darhol baholay olaman.
2. **Sotuvchi sifatida** men "Yangi shartnoma" tugmasini bossam, modal popup emas, balki ro'yxat pastga siljib forma ochilishini xohlayman — bu menga kontekstni yo'qotmasdan tezkor ishlashga yordam beradi.
3. **Sotuvchi sifatida** shartnoma raqami avtomatik berilsin (`26-01`, `26-02`...) — qo'lda hisoblashim shart bo'lmasin. Admin avtomatik nomerlashni o'chirib qo'ya olishi kerak.
4. **Menejer sifatida** shartnoma ustiga bossam, uning ostidagi spetsifikatsiyalar dropdown bo'lib ochilsin va har bir spets uchun "savdo yaratish" tugmasi bo'lsin.
5. **Buxgalter sifatida** har bir shartnomani PDF (2 sahifa) yoki Excel (2 sheet) sifatida yuklab olishni xohlayman — bosma nusxa uchun.
6. **Admin sifatida** o'chirilgan shartnoma raqami qayta ishlatilmasin (audit izi uchun) — `26-05` o'chirilsa, keyingisi `26-06` bo'lsin, `26-05` qayta tug'ilmasin.

### 3A.3 Acceptance criteria

- [ ] `Contract` modeli `status`, `notes`, `specCounter` maydonlari bilan kengaytirilgan.
- [ ] Yangi `Specification` va `SpecProduct` modellari mavjud, Prisma migratsiya o'tgan.
- [ ] `Sale.specId` (optional) maydoni qo'shilgan, mavjud savdolar buzilmagan.
- [ ] `GET /api/contracts` aggregate ma'lumot qaytaradi: `paidAmount`, `deliveredAmount`, `specCount`, `invoiceAmount`, `status`.
- [ ] `GET /api/contracts/next-number` keyingi shartnoma raqamini qaytaradi (`MAX(numericPart) + 1` strategiyasi).
- [ ] CRUD endpointlar `/api/specs` va `/api/specs/:id/products` ishlaydi, Zod bilan validatsiyalangan.
- [ ] `Contracts.jsx` to'liq qayta yozilgan: ro'yxat + expand + inline form + 3 nuqta menu.
- [ ] Yangi shartnoma forma popup emas — accordion/inline (`useInlineForm` hook).
- [ ] "Yangi mijoz qo'shish" mini-modal Contracts sahifasidan chaqiriladi.
- [ ] Shartnoma PDF eksporti 2 sahifa, Excel eksporti 2 sheet.
- [ ] `Setting.data` JSON ga `autoContractNumbering: boolean` va `contractNumberPrefix: string` qo'shilgan.
- [ ] QQS hisobi `VAT_RATE` constantdan keladi (default 0.12), `calcVat()` helper sifatida share qilinadi.
- [ ] Vitest testlar yangilangan: `contracts.test.mjs` aggregate qaytarishni tekshiradi, yangi `specs.test.mjs` Spec CRUD ni tekshiradi.

### 3A.4 Schema o'zgarishlar

**`backend/prisma/schema.prisma` ga qo'shing/o'zgartiring:**

```prisma
model Contract {
  id           String         @id @default(uuid())
  number       String         // formatda "26-01"
  numericPart  Int            // raqamli qism, sort + MAX uchun (auto-numbering)
  yearPart     Int            // yil prefiksi, masalan 26 (2026)
  date         DateTime
  totalValue   Float
  notes        String?        // multiline izoh
  status       String         @default("yangi") // "yangi" | "amalda" | "yopilgan"
  specCounter  Int            @default(0)       // ichki Spec hisoblagich (audit izi)
  clientId     String
  client       Client         @relation(fields: [clientId], references: [id])
  sales        Sale[]
  payments     Payment[]
  specifications Specification[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@unique([number, clientId])
  @@unique([yearPart, numericPart]) // global yil bo'yicha unique — qayta ishlatilmaslik garantiyasi
  @@index([clientId])
  @@index([status])
  @@index([date])
}

model Specification {
  id           String         @id @default(uuid())
  number       Int            // har bir shartnoma uchun 1, 2, 3... (Contract.specCounter dan keladi)
  date         DateTime       @default(now())
  totalValue   Float          @default(0)
  notes        String?
  contractId   String
  contract     Contract       @relation(fields: [contractId], references: [id], onDelete: Cascade)
  products     SpecProduct[]
  sales        Sale[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@unique([contractId, number])
  @@index([contractId])
  @@index([date])
}

model SpecProduct {
  id            String        @id @default(uuid())
  specId        String
  productId     String
  unit          String        // "kv.m" | "kub.m" | "kg"
  quantity      Float
  unitPriceVat  Float          // QQS bilan birlik narx
  vatAmount     Float          // QQS summasi (rowTotal / 1.12 * 0.12)
  rowTotal      Float          // quantity * unitPriceVat (QQS bilan jami)
  spec          Specification  @relation(fields: [specId], references: [id], onDelete: Cascade)
  product       Product        @relation(fields: [productId], references: [id])
  createdAt     DateTime       @default(now())

  @@index([specId])
  @@index([productId])
}

model Sale {
  id             String         @id @default(uuid())
  date           DateTime
  nakladnoy      String
  sellerName     String
  transportNum   String?
  totalAmount    Float
  clientId       String
  contractId     String?        // OPTIONAL bo'ldi — Spec orqali bog'lanadi
  specId         String?        // YANGI — qaysi spets bo'yicha
  client         Client         @relation(fields: [clientId], references: [id])
  contract       Contract?      @relation(fields: [contractId], references: [id])
  spec           Specification? @relation(fields: [specId], references: [id])
  products       SaleProduct[]
  createdAt      DateTime       @default(now())

  @@index([clientId, date])
  @@index([contractId])
  @@index([specId])
}

model Product {
  // ... mavjud maydonlar ...
  specProducts  SpecProduct[]   // YANGI relation
}
```

**Migratsiya buyruqlari:**
```powershell
cd backend
npx prisma db push
npx prisma generate
```

**MUHIM (data migration):** Mavjud `Contract.number` qiymatlari `numericPart` va `yearPart` maydonlariga ajratilishi kerak. Bir martalik skript:

```powershell
node scripts/backfill-contract-numeric.js
```

Skript mantiqi: har bir Contract uchun `number` ni "26-01" formatida regex bilan ajratadi (`/^(\d{2})-(\d+)$/`), `yearPart=26`, `numericPart=1` qiladi. Agar format mos kelmasa, `yearPart = year % 100` (current year) va `numericPart = MAX + 1` beriladi (idempotent — qayta ishlatish xavfsiz).

### 3A.5 Backend — step-by-step

#### Step 14b.1 — Dependencies

```powershell
cd backend
npm install exceljs pdfkit
# Yoki Puppeteer (HTML→PDF, lekin og'irroq):
# npm install puppeteer
```

**Tavsiya:** `pdfkit` (zero-dependency, kichik) yoki `pdf-lib`. Puppeteer faqat dizayn juda murakkab bo'lsa.

#### Step 14b.2 — `lib/vat.js` (yangi fayl)

```js
const VAT_RATE = 0.12;

// total — QQS bilan jami summa; chiqaradi QQS summasi
const calcVat = (totalWithVat) => Number((totalWithVat / (1 + VAT_RATE) * VAT_RATE).toFixed(2));

// rowTotal — quantity × unitPriceVat
const calcRowTotal = (quantity, unitPriceVat) =>
  Number((quantity * unitPriceVat).toFixed(2));

module.exports = { VAT_RATE, calcVat, calcRowTotal };
```

#### Step 14b.3 — `routes/_schemas.js` ga qo'shing

```js
const specProductSchema = z.object({
  productId:    z.string().uuid(),
  unit:         z.enum(['kv.m', 'kub.m', 'kg']),
  quantity:     z.coerce.number().positive(),
  unitPriceVat: z.coerce.number().positive(),
});

const specSchema = z.object({
  contractId: z.string().uuid(),
  date:       z.string().min(1).optional(), // default: now
  notes:      z.string().max(1000).default(''),
  products:   z.array(specProductSchema).min(1),
});

// contractSchema ni kengaytiring:
const contractSchema = z.object({
  number:      z.string().min(1).max(50).optional(), // optional bo'ldi (auto-numbering)
  date:        z.string().min(1),
  totalValue:  z.coerce.number().nonnegative(),
  clientId:    z.string().uuid(),
  notes:       z.string().max(2000).default(''),
  status:      z.enum(['yangi', 'amalda', 'yopilgan']).default('yangi'),
});

// settingSchema ga yangi maydonlar:
const settingSchema = z.object({
  // ... mavjud maydonlar ...
  autoContractNumbering: z.boolean().default(true),
  contractNumberPrefix:  z.string().max(10).default('year'), // "year" | "custom"
  vatRate:               z.coerce.number().min(0).max(1).default(0.12),
});

module.exports = {
  // ... mavjudlar ...
  specSchema,
  specProductSchema,
};
```

#### Step 14b.4 — `routes/contracts.js` to'liq qayta yozish

```js
const router = require('express').Router();
const prisma = require('../prisma');
const { contractSchema } = require('./_schemas');

// GET /api/contracts — pagination + aggregate
router.get('/', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search = (req.query.search || '').trim();
    const clientId = req.query.clientId;
    const status   = req.query.status;
    const sortBy   = req.query.sortBy   || 'date';
    const sortDir  = req.query.sortDir  || 'desc';
    const skip = (page - 1) * limit;

    const where = {
      ...(clientId ? { clientId } : {}),
      ...(status   ? { status }   : {}),
      ...(search ? {
        OR: [
          { number: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, inn: true } },
          _count: { select: { specifications: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    // Aggregate (SQL — N+1 dan saqlanish)
    const ids = contracts.map(c => c.id);
    const aggregates = ids.length ? await prisma.$queryRaw`
      SELECT
        c.id,
        COALESCE(SUM(DISTINCT p.amount), 0)::float AS paid_amount,
        COALESCE(SUM(sp."rowAmount"), 0)::float    AS delivered_amount
      FROM "Contract" c
      LEFT JOIN "Payment"     p  ON p."contractId" = c.id
      LEFT JOIN "Sale"        s  ON s."contractId" = c.id
      LEFT JOIN "SaleProduct" sp ON sp."saleId"    = s.id
      WHERE c.id = ANY(${ids}::uuid[])
      GROUP BY c.id
    ` : [];

    const aggMap = Object.fromEntries(aggregates.map(a => [a.id, a]));
    const data = contracts.map(c => ({
      ...c,
      specCount:        c._count.specifications,
      paidAmount:       aggMap[c.id]?.paid_amount      || 0,
      deliveredAmount:  aggMap[c.id]?.delivered_amount || 0,
      invoiceAmount:    0, // kelajakda Invoice modelidan
    }));

    res.json({ data, total, page, limit });
  } catch (e) { next(e); }
});

// GET /api/contracts/next-number — auto-numbering
router.get('/next-number', async (req, res, next) => {
  try {
    const year   = new Date().getFullYear() % 100; // 2026 → 26
    const maxRow = await prisma.contract.aggregate({
      where: { yearPart: year },
      _max:  { numericPart: true },
    });
    const next = (maxRow._max.numericPart || 0) + 1;
    const number = `${String(year).padStart(2, '0')}-${String(next).padStart(2, '0')}`;
    res.json({ number, yearPart: year, numericPart: next });
  } catch (e) { next(e); }
});

// GET /api/contracts/:id — bitta shartnoma + spetslar + aggregate
router.get('/:id', async (req, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        specifications: {
          include: {
            products: { include: { product: true } },
            _count:   { select: { sales: true } },
          },
          orderBy: { number: 'asc' },
        },
      },
    });
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    // Spec bo'yicha delivered aggregate
    const deliveredBySpec = await prisma.$queryRaw`
      SELECT s."specId", COALESCE(SUM(sp."rowAmount"), 0)::float AS delivered
      FROM "Sale" s
      LEFT JOIN "SaleProduct" sp ON sp."saleId" = s.id
      WHERE s."contractId" = ${req.params.id}::uuid AND s."specId" IS NOT NULL
      GROUP BY s."specId"
    `;
    const deliveredMap = Object.fromEntries(deliveredBySpec.map(r => [r.specId, r.delivered]));

    contract.specifications = contract.specifications.map(s => ({
      ...s,
      deliveredAmount: deliveredMap[s.id] || 0,
      saleCount: s._count.sales,
    }));

    res.json(contract);
  } catch (e) { next(e); }
});

// POST /api/contracts — auto yoki manual numbering
router.post('/', async (req, res, next) => {
  try {
    const body = contractSchema.parse(req.body);
    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg = settings ? JSON.parse(settings.data) : {};
    const autoNum = cfg.autoContractNumbering !== false; // default true

    let { number } = body;
    const year = new Date(body.date).getFullYear() % 100;
    let numericPart;

    if (autoNum || !number) {
      const maxRow = await prisma.contract.aggregate({
        where: { yearPart: year },
        _max:  { numericPart: true },
      });
      numericPart = (maxRow._max.numericPart || 0) + 1;
      number = `${String(year).padStart(2, '0')}-${String(numericPart).padStart(2, '0')}`;
    } else {
      // Manual — number "26-05" formatida bo'lishi kerak
      const m = /^(\d{1,2})-(\d+)$/.exec(number);
      if (!m) return res.status(400).json({ error: 'Raqam formati: YY-NN (masalan 26-05)' });
      numericPart = parseInt(m[2], 10);
    }

    const contract = await prisma.contract.create({
      data: {
        number, yearPart: year, numericPart,
        date:       new Date(body.date),
        totalValue: body.totalValue,
        clientId:   body.clientId,
        notes:      body.notes || null,
        status:     body.status || 'yangi',
      },
    });
    res.json(contract);
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Bu raqam allaqachon mavjud' });
    }
    next(e);
  }
});

// PUT /api/contracts/:id
router.put('/:id', async (req, res, next) => {
  try {
    const body = contractSchema.partial().parse(req.body);
    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...(body.date       !== undefined ? { date: new Date(body.date) } : {}),
        ...(body.totalValue !== undefined ? { totalValue: body.totalValue } : {}),
        ...(body.notes      !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status     !== undefined ? { status: body.status } : {}),
        // number/numericPart o'zgartirilmaydi — audit qoidasi (#6)
      },
      include: { client: true },
    });
    res.json(contract);
  } catch (e) { next(e); }
});

// DELETE /api/contracts/:id — Specification onDelete: Cascade, lekin Sale/Payment bo'lsa 409
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.contract.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2003') {
      return res.status(409).json({ error: "Bog'langan savdo yoki to'lov mavjud" });
    }
    next(e);
  }
});

module.exports = router;
```

#### Step 14b.5 — `routes/specs.js` (yangi fayl)

```js
const router = require('express').Router();
const prisma = require('../prisma');
const { specSchema } = require('./_schemas');
const { calcVat, calcRowTotal } = require('../lib/vat');

// GET /api/specs?contractId=
router.get('/', async (req, res, next) => {
  try {
    const { contractId } = req.query;
    if (!contractId) return res.status(400).json({ error: 'contractId majburiy' });
    const specs = await prisma.specification.findMany({
      where: { contractId },
      include: { products: { include: { product: true } } },
      orderBy: { number: 'asc' },
    });
    res.json({ data: specs });
  } catch (e) { next(e); }
});

// POST /api/specs — transaction: spec yarat + product qatorlari + contract.specCounter ++
router.post('/', async (req, res, next) => {
  try {
    const body = specSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // MAX(spec.number) + 1 — audit qoidasi #6 (o'chirilgan raqam qayta ishlatilmaydi)
      const last = await tx.specification.aggregate({
        where: { contractId: body.contractId },
        _max: { number: true },
      });
      const number = (last._max.number || 0) + 1;

      const productsData = body.products.map(p => {
        const rowTotal  = calcRowTotal(p.quantity, p.unitPriceVat);
        const vatAmount = calcVat(rowTotal);
        return {
          productId:    p.productId,
          unit:         p.unit,
          quantity:     p.quantity,
          unitPriceVat: p.unitPriceVat,
          rowTotal,
          vatAmount,
        };
      });
      const totalValue = productsData.reduce((s, p) => s + p.rowTotal, 0);

      const spec = await tx.specification.create({
        data: {
          number,
          contractId: body.contractId,
          date:       body.date ? new Date(body.date) : new Date(),
          notes:      body.notes || null,
          totalValue,
          products:   { create: productsData },
        },
        include: { products: { include: { product: true } } },
      });

      await tx.contract.update({
        where: { id: body.contractId },
        data: { specCounter: { increment: 1 } },
      });

      return spec;
    });

    res.json(result);
  } catch (e) { next(e); }
});

// PUT /api/specs/:id — to'liq almashtirish (mahsulot qatorlari ham)
router.put('/:id', async (req, res, next) => {
  try {
    const body = specSchema.partial({ contractId: true }).parse(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      if (body.products) {
        await tx.specProduct.deleteMany({ where: { specId: req.params.id } });
        const productsData = body.products.map(p => {
          const rowTotal  = calcRowTotal(p.quantity, p.unitPriceVat);
          const vatAmount = calcVat(rowTotal);
          return {
            specId: req.params.id,
            productId:    p.productId,
            unit:         p.unit,
            quantity:     p.quantity,
            unitPriceVat: p.unitPriceVat,
            rowTotal,
            vatAmount,
          };
        });
        await tx.specProduct.createMany({ data: productsData });
        const totalValue = productsData.reduce((s, p) => s + p.rowTotal, 0);
        await tx.specification.update({
          where: { id: req.params.id },
          data: { totalValue, notes: body.notes ?? undefined,
                  date: body.date ? new Date(body.date) : undefined },
        });
      } else {
        await tx.specification.update({
          where: { id: req.params.id },
          data: {
            ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
            ...(body.date  !== undefined ? { date: new Date(body.date) } : {}),
          },
        });
      }
      return tx.specification.findUnique({
        where: { id: req.params.id },
        include: { products: { include: { product: true } } },
      });
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// DELETE /api/specs/:id — agar bog'langan Sale bo'lsa 409
router.delete('/:id', async (req, res, next) => {
  try {
    const linkedSales = await prisma.sale.count({ where: { specId: req.params.id } });
    if (linkedSales > 0) {
      return res.status(409).json({ error: "Bu spets bo'yicha savdo mavjud, avval savdoni o'chiring" });
    }
    await prisma.specification.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
```

#### Step 14b.6 — `routes/export.js` (yangi fayl) — PDF + Excel

```js
const router = require('express').Router();
const prisma = require('../prisma');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

async function loadFullContract(id) {
  return prisma.contract.findUnique({
    where: { id },
    include: {
      client: true,
      specifications: {
        include: { products: { include: { product: true } } },
        orderBy: { number: 'asc' },
      },
    },
  });
}

// GET /api/contracts/:id/pdf — 2 sahifa
router.get('/contracts/:id/pdf', async (req, res, next) => {
  try {
    const contract = await loadFullContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });
    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    const cfg = settings ? JSON.parse(settings.data) : {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="shartnoma-${contract.number}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    // SAHIFA 1 — Shartnoma matni
    doc.font('Helvetica-Bold').fontSize(16).text(`Shartnoma № ${contract.number}`, { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica').fontSize(10);
    doc.text(`Sana: ${new Date(contract.date).toLocaleDateString('ru-RU')}`);
    doc.text(`Sotuvchi: ${cfg.companyName || ''}`);
    doc.text(`INN: ${cfg.companyInn || ''}`);
    doc.text(`Manzil: ${cfg.companyAddress || ''}`);
    doc.moveDown();
    doc.text(`Mijoz: ${contract.client.name}`);
    doc.text(`Mijoz INN: ${contract.client.inn}`);
    doc.text(`Mijoz manzili: ${contract.client.address || '—'}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').text(`Umumiy summa: ${Math.round(contract.totalValue).toLocaleString('ru-RU')} so'm`);
    if (contract.notes) {
      doc.moveDown().font('Helvetica').text(`Izoh: ${contract.notes}`);
    }

    // SAHIFA 2 — Spetsifikatsiya jadvali
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).text('Spetsifikatsiyalar', { align: 'center' });
    doc.moveDown();

    for (const spec of contract.specifications) {
      doc.font('Helvetica-Bold').fontSize(11)
         .text(`Spets № ${spec.number} — ${new Date(spec.date).toLocaleDateString('ru-RU')}`);
      doc.font('Helvetica').fontSize(9);
      const header = ['Mahsulot', 'Birlik', 'Soni', 'Narx (QQS bilan)', 'QQS', 'Jami'];
      // sodda jadval (pdfkit-table package ham ishlatish mumkin)
      doc.text(header.join('  |  '));
      for (const p of spec.products) {
        doc.text([
          p.product.article,
          p.unit,
          p.quantity,
          Math.round(p.unitPriceVat).toLocaleString('ru-RU'),
          Math.round(p.vatAmount).toLocaleString('ru-RU'),
          Math.round(p.rowTotal).toLocaleString('ru-RU'),
        ].join('  |  '));
      }
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold')
         .text(`Spets jami: ${Math.round(spec.totalValue).toLocaleString('ru-RU')} so'm`);
      doc.moveDown();
    }
    doc.end();
  } catch (e) { next(e); }
});

// GET /api/contracts/:id/excel — 2 sheet
router.get('/contracts/:id/excel', async (req, res, next) => {
  try {
    const contract = await loadFullContract(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Topilmadi' });

    const wb = new ExcelJS.Workbook();
    const wsContract = wb.addWorksheet('Shartnoma');
    wsContract.addRow(['Shartnoma raqami', contract.number]);
    wsContract.addRow(['Sana', new Date(contract.date).toLocaleDateString('ru-RU')]);
    wsContract.addRow(['Mijoz', contract.client.name]);
    wsContract.addRow(['INN', contract.client.inn]);
    wsContract.addRow(['Umumiy summa', contract.totalValue]);
    wsContract.addRow(['Izoh', contract.notes || '']);

    const wsSpec = wb.addWorksheet('Spetsifikatsiya');
    wsSpec.addRow(['Spets №', 'Mahsulot', 'Birlik', 'Soni', 'Narx (QQS bilan)', 'QQS', 'Jami']);
    for (const spec of contract.specifications) {
      for (const p of spec.products) {
        wsSpec.addRow([
          spec.number, p.product.article, p.unit,
          p.quantity, p.unitPriceVat, p.vatAmount, p.rowTotal,
        ]);
      }
    }

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="shartnoma-${contract.number}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
});

module.exports = router;
```

#### Step 14b.7 — `app.js` ga mount qiling

```js
app.use('/api/contracts', requireAuth, require('./routes/contracts'));
app.use('/api/specs',     requireAuth, require('./routes/specs'));
app.use('/api',           requireAuth, require('./routes/export')); // /api/contracts/:id/pdf, /excel
```

**Diqqat:** `export.js` `/api/contracts/:id/pdf` ni eshitganligi sababli, uni `contracts` routerdan **keyin** mount qiling yoki to'g'ridan-to'g'ri `app.get('/api/contracts/:id/pdf', ...)` registratsiya qiling.

### 3A.6 Frontend — step-by-step

#### Step 14b.8 — `frontend/src/hooks/useInlineForm.js` (yangi fayl)

```js
import { useState, useCallback, useEffect } from 'react';

// Accordion/inline forma uchun umumiy hook
// Esc — yopadi; isOpen true bo'lganda forma ko'rinadi
export function useInlineForm(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(o => !o), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return { isOpen, open, close, toggle };
}
```

#### Step 14b.9 — `frontend/src/lib/vat.js` (yangi fayl)

```js
export const VAT_RATE = 0.12;

export const calcVat = (totalWithVat) =>
  Math.round(totalWithVat / (1 + VAT_RATE) * VAT_RATE * 100) / 100;

export const calcRowTotal = (qty, price) =>
  Math.round(qty * price * 100) / 100;
```

#### Step 14b.10 — `frontend/src/pages/Contracts.jsx` to'liq qayta yozish

**Tarkibiy elementlar:**
- `ContractsList` — asosiy ro'yxat
- `ContractForm` (inline accordion) — yangi shartnoma yaratish (popup emas)
- `ContractRow` — ro'yxat qatori + expand button (spetslar dropdown)
- `SpecForm` (inline) — shartnoma ichida spets yaratish
- `QuickAddClientModal` — sodda mijoz qo'shish (kichik modal)

**UI strukturasi:**

```jsx
<div>
  <header className="flex justify-between">
    <h1>Shartnomalar</h1>
    <button onClick={form.toggle}>+ Yangi shartnoma</button>
  </header>

  {form.isOpen && (
    <div className="accordion-panel border rounded-lg p-4 mb-4 bg-white">
      <ContractForm onSaved={...} onCancel={form.close} />
    </div>
  )}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Mijoz</th>
        <th>INN</th>
        <th>Shartnoma raqami</th>
        <th>Sana</th>
        <th>Summa</th>
        <th>Payments</th>
        <th>Delivered</th>
        <th>Specs</th>
        <th>Faktura</th>
        <th>Status</th>
        <th>Amallar</th>
      </tr>
    </thead>
    <tbody>
      {contracts.map((c, idx) => (
        <ContractRow key={c.id} contract={c} index={idx + 1} />
      ))}
    </tbody>
  </table>
</div>
```

**`ContractRow.jsx`:**

```jsx
function ContractRow({ contract, index }) {
  const [expanded, setExpanded] = useState(false);
  const [specs, setSpecs] = useState(null);

  const toggleExpand = async () => {
    if (!expanded && !specs) {
      const { data } = await api.get(`/api/contracts/${contract.id}`);
      setSpecs(data.specifications);
    }
    setExpanded(e => !e);
  };

  return (
    <>
      <tr onClick={toggleExpand} className="cursor-pointer">
        <td>{index}</td>
        <td>{contract.client.name}</td>
        <td>{contract.client.inn}</td>
        <td>{contract.number}</td>
        <td>{fmtDate(contract.date)}</td>
        <td>{fmt(contract.totalValue)}</td>
        <td>{fmt(contract.paidAmount)}</td>
        <td>{fmt(contract.deliveredAmount)}</td>
        <td>{contract.specCount}</td>
        <td>{fmt(contract.invoiceAmount)}</td>
        <td><StatusBadge status={contract.status} /></td>
        <td><ActionMenu contract={contract} /></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={12} className="bg-zinc-50 p-4">
            <SpecList specs={specs} contractId={contract.id} />
          </td>
        </tr>
      )}
    </>
  );
}
```

**`ContractForm.jsx`:**

```jsx
function ContractForm({ onSaved, onCancel }) {
  const [clientId, setClientId]  = useState('');
  const [clientInn, setClientInn] = useState('');
  const [number, setNumber]       = useState('');
  const [autoNum, setAutoNum]     = useState(true);
  const [date, setDate]           = useState(todayIso());
  const [totalValue, setTotalValue] = useState('');
  const [notes, setNotes]         = useState('');
  const [specs, setSpecs]         = useState([]); // ixtiyoriy — shartnoma + spec birga
  const [showQuickClient, setShowQuickClient] = useState(false);

  useEffect(() => {
    if (autoNum) {
      api.get('/api/contracts/next-number').then(r => setNumber(r.data.number));
    }
  }, [autoNum]);

  const save = async () => {
    const contract = await api.post('/api/contracts', {
      number: autoNum ? undefined : number,
      date, totalValue: Number(totalValue), clientId, notes,
    });
    // Agar inline specs ham bo'lsa
    for (const spec of specs) {
      await api.post('/api/specs', { ...spec, contractId: contract.data.id });
    }
    toast.success('Shartnoma yaratildi');
    onSaved?.(contract.data);
  };

  useModalKeys(save, onCancel); // Ctrl+Enter / Escape

  return (
    <div className="space-y-3">
      <ClientPicker
        value={clientId}
        onChange={(c) => { setClientId(c.id); setClientInn(c.inn); }}
        onAddNew={() => setShowQuickClient(true)}
      />
      <input value={clientInn} readOnly placeholder="INN" />
      <div className="flex gap-2 items-center">
        <input value={number} disabled={autoNum} onChange={e => setNumber(e.target.value)} />
        <label><input type="checkbox" checked={autoNum} onChange={e => setAutoNum(e.target.checked)} /> Auto</label>
      </div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="Umumiy summa" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Izoh" />

      <SpecFormRepeat specs={specs} onChange={setSpecs} />

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}>Bekor</button>
        <button onClick={save} className="bg-blue-600 text-white">Saqlash</button>
      </div>

      {showQuickClient && <QuickAddClientModal onClose={() => setShowQuickClient(false)} onSaved={(c) => { setClientId(c.id); setClientInn(c.inn); setShowQuickClient(false); }} />}
    </div>
  );
}
```

**`SpecForm.jsx`** — har bir mahsulot qatori uchun:

```jsx
function SpecProductRow({ row, onChange, onRemove }) {
  const total = calcRowTotal(row.quantity, row.unitPriceVat);
  const vat   = calcVat(total);
  return (
    <tr>
      <td><ProductPicker value={row.productId} onChange={pid => onChange({ ...row, productId: pid })} /></td>
      <td>
        <select value={row.unit} onChange={e => onChange({ ...row, unit: e.target.value })}>
          <option value="kv.m">kv.m</option>
          <option value="kub.m">kub.m</option>
          <option value="kg">kg</option>
        </select>
      </td>
      <td><input type="number" value={row.quantity} onChange={e => onChange({ ...row, quantity: Number(e.target.value) })} /></td>
      <td><input type="number" value={row.unitPriceVat} onChange={e => onChange({ ...row, unitPriceVat: Number(e.target.value) })} /></td>
      <td>{fmt(vat)}</td>
      <td>{fmt(total)}</td>
      <td><button onClick={onRemove}>×</button></td>
    </tr>
  );
}
```

#### Step 14b.11 — `Settings.jsx` ga yangi sektsiya

```jsx
<section>
  <h2>Shartnoma sozlamalari</h2>
  <label>
    <input type="checkbox" checked={settings.autoContractNumbering}
           onChange={e => setSettings({ ...settings, autoContractNumbering: e.target.checked })} />
    Avtomatik nomerlash (YY-NN format)
  </label>
  <label>
    QQS stavkasi (%):
    <input type="number" step="0.01" value={(settings.vatRate || 0.12) * 100}
           onChange={e => setSettings({ ...settings, vatRate: Number(e.target.value) / 100 })} />
  </label>
</section>
```

#### Step 14b.12 — Yuklab olish tugmalari

```jsx
const downloadPdf = async (id) => {
  const res = await api.get(`/api/contracts/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url; a.download = `shartnoma-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### 3A.7 Test rejasi (Vitest + Supertest)

`backend/tests/specs.test.mjs` (yangi):

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { makeClient, makeContract, makeProduct } from './helpers.mjs';
import { authHeader } from './helpers/auth.js';

describe('Specifications', () => {
  let contract, product, h;
  beforeAll(async () => {
    h = await authHeader('admin');
    const client = await makeClient();
    contract = await makeContract(client.id);
    product = await makeProduct();
  });

  it('POST /api/specs creates spec with auto-number = 1', async () => {
    const res = await request(app).post('/api/specs').set(h).send({
      contractId: contract.id,
      products: [{ productId: product.id, unit: 'kv.m', quantity: 100, unitPriceVat: 50000 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.number).toBe(1);
    expect(res.body.totalValue).toBeCloseTo(100 * 50000);
  });

  it('Second spec gets number 2', async () => {
    const res = await request(app).post('/api/specs').set(h).send({
      contractId: contract.id,
      products: [{ productId: product.id, unit: 'kg', quantity: 10, unitPriceVat: 1000 }],
    });
    expect(res.body.number).toBe(2);
  });

  it('DELETE first spec, third spec still gets number 3 (gap qoladi)', async () => {
    await request(app).delete(`/api/specs/${firstSpecId}`).set(h);
    const res = await request(app).post('/api/specs').set(h).send({
      contractId: contract.id,
      products: [{ productId: product.id, unit: 'kg', quantity: 5, unitPriceVat: 2000 }],
    });
    expect(res.body.number).toBe(3); // 1 qayta ishlatilmaydi
  });
});
```

### 3A.8 Definition of Done — Bosqich 14b

- [ ] Schema `Contract` kengaytirilgan (`numericPart`, `yearPart`, `notes`, `status`, `specCounter`, `updatedAt`)
- [ ] `Specification`, `SpecProduct` modellari yaratilgan
- [ ] `Sale.specId` qo'shilgan, `Sale.contractId` optional bo'lgan
- [ ] `prisma db push` o'tgan, `prisma generate` ishlatilgan
- [ ] `scripts/backfill-contract-numeric.js` skripti yozilgan va mavjud shartnomalar ko'chirilgan
- [ ] `lib/vat.js` (backend) + `lib/vat.js` (frontend) — `VAT_RATE = 0.12`, `calcVat`, `calcRowTotal`
- [ ] `routes/_schemas.js` ga `specSchema`, `specProductSchema` qo'shilgan, `contractSchema` kengaytirilgan
- [ ] `routes/contracts.js` to'liq qayta yozilgan: pagination, aggregate (`paidAmount`, `deliveredAmount`, `specCount`, `invoiceAmount`)
- [ ] `GET /api/contracts/next-number` ishlaydi
- [ ] `routes/specs.js` mavjud: GET, POST, PUT, DELETE
- [ ] `routes/export.js` mavjud: `/api/contracts/:id/pdf`, `/api/contracts/:id/excel`
- [ ] `app.js` da yangi routerlar `requireAuth` bilan mount qilingan
- [ ] `pdfkit` + `exceljs` `package.json` da
- [ ] `useInlineForm` hook yaratilgan, Esc bilan yopiladi
- [ ] `Contracts.jsx` to'liq qayta yozilgan: ro'yxat + 12 ustun + expand + inline form
- [ ] `ContractForm`, `SpecForm`, `ContractRow`, `QuickAddClientModal` komponentlari mavjud
- [ ] Auto-numbering checkbox ishlaydi (Settings + ContractForm)
- [ ] Spetslar dropdown da har birining "savdo yaratish" tugmasi mavjud (Bosqich 14c bilan integratsiya)
- [ ] PDF/Excel yuklab olish tugmalari ishlaydi (blob response)
- [ ] `Settings.jsx` da `autoContractNumbering` va `vatRate` sozlamalari
- [ ] `contracts.test.mjs` yangilangan (aggregate qaytarish), `specs.test.mjs` yozilgan
- [ ] Manual QA: yangi shartnoma yaratish → ro'yxatda ko'rinish → expand → spets qo'shish → PDF yuklab olish
- [ ] `TEXNIK_VAZIFA.md` ga Bosqich 14b qo'shilgan, holat `DONE ✅`
- [ ] Git commit: `feat(contracts): specifications, auto-numbering, PDF/Excel export (Bosqich 14b)`

---

## 3B. PRD — Bosqich 14c: Savdolar inline form + Spec bog'lanish

> **Priority:** P0
> **Estimated effort:** ~1 ish kun
> **Boshlash sharti:** Bosqich 14b tugashi (Spec modeli kerak)

### 3B.1 Maqsad

`Sales.jsx` da modal popup o'rniga **inline accordion forma** ishlatish (Contracts kabi). Savdo endi konkret **Spetsifikatsiyaga** bog'lanadi (shartnomaga emas), Spec orqali avtomatik `contractId` ham bog'lanadi. Savdolar ro'yxatida `Shartnoma raqami` va `Spets raqami` ustunlari ko'rinadi.

### 3B.2 Acceptance criteria

- [ ] `Sales.jsx` da "Yangi savdo" tugmasi modal emas, inline forma ochadi (`useInlineForm`).
- [ ] Savdo yaratishda spets tanlanadi (mijoz → shartnoma → spets ketma-ketligi).
- [ ] Spets tanlanganda, ushbu spets mahsulotlari avtomatik forma qatorlariga to'ldiriladi (foydalanuvchi miqdorlarni qisman yetkazib berishi mumkin).
- [ ] Backend `POST /api/sales` `specId` qabul qiladi (optional, lekin specId bo'lsa contractId avtomatik to'ldiriladi).
- [ ] `Sales.jsx` ro'yxatida `Shartnoma raqami` va `Spets №` ustunlari ko'rinadi.
- [ ] Mavjud savdolar (`specId = null`) buzilmaydi.

### 3B.3 Backend o'zgarishlari

#### `routes/_schemas.js`

```js
const saleSchema = z.object({
  date:         z.string().min(1),
  nakladnoy:    z.string().min(1),
  sellerName:   z.string().min(1),
  transportNum: z.string().nullable().default(''),
  clientId:     z.string().uuid(),
  contractId:   z.string().uuid().nullable().optional(), // OPTIONAL bo'ldi
  specId:       z.string().uuid().nullable().optional(), // YANGI
  products:     z.array(saleProductSchema).min(1),
});
```

#### `routes/sales.js` POST

```js
router.post('/', async (req, res, next) => {
  try {
    const body = saleSchema.parse(req.body);

    // Agar specId bor — contractId ni Spec dan oling (overrride)
    let contractId = body.contractId;
    if (body.specId) {
      const spec = await prisma.specification.findUnique({
        where: { id: body.specId },
        select: { contractId: true },
      });
      if (!spec) return res.status(400).json({ error: 'Spec topilmadi' });
      contractId = spec.contractId;
    }

    const sale = await prisma.$transaction(async (tx) => {
      const totalAmount = body.products.reduce((s, p) => s + p.rowAmount, 0);
      const s = await tx.sale.create({
        data: {
          date: new Date(body.date),
          nakladnoy: body.nakladnoy,
          sellerName: body.sellerName,
          transportNum: body.transportNum || null,
          totalAmount,
          clientId: body.clientId,
          contractId: contractId || null,
          specId:     body.specId || null,
          products: { create: body.products },
        },
        include: { products: { include: { product: true } } },
      });
      return s;
    });
    res.json(sale);
  } catch (e) { next(e); }
});
```

#### `routes/sales.js` GET

`include: { contract: { select: { number: true } }, spec: { select: { number: true } } }` qo'shing.

### 3B.4 Frontend — `Sales.jsx`

**O'zgarishlar:**

1. Modal komponenti olib tashlanadi.
2. `useInlineForm` hook ishlatiladi.
3. `SaleForm.jsx` yangi komponent — accordion ichida.
4. Spec tanlash: `mijoz → shartnoma → spets` ketma-ketligi.
5. Spets tanlanganda `useEffect(() => api.get(/api/specs?...).then(...))` orqali Spec mahsulotlarini olib, forma qatorlariga prefill.
6. Jadval ustunlari: `#`, `Sana`, `Yuk xati`, `Mijoz`, **`Shartnoma`**, **`Spets №`**, `Summa`, `Amallar`.

### 3B.5 Definition of Done — Bosqich 14c

- [ ] `Sale.specId` schema da, `prisma db push` o'tgan (14b da bajarilgan)
- [ ] `saleSchema` da `specId` optional, `contractId` optional
- [ ] `routes/sales.js` POST `specId` qabul qiladi, contractId avtomatik
- [ ] `routes/sales.js` GET response da `contract.number`, `spec.number` bor
- [ ] `Sales.jsx` modal yo'q, accordion inline forma bor
- [ ] `SaleForm.jsx` — mijoz → shartnoma → spets cascade
- [ ] Spec tanlanganda mahsulotlar prefill bo'ladi
- [ ] Ro'yxatda `Shartnoma raqami`, `Spets №` ustunlari
- [ ] Mavjud testlar buzilmaydi
- [ ] `TEXNIK_VAZIFA.md` ga Bosqich 14c qo'shilgan
- [ ] Git commit: `feat(sales): inline form + spec linkage (Bosqich 14c)`

---

## 3C. Modulli Arxitektura — Qoidalar

Bu PRD `v3.0` dan boshlab har bir yangi modul **alohida feature** sifatida qo'shiladi, mavjud kodga minimal ta'sir bilan.

### 3C.1 Yangi modul qo'shish algoritmi

Har bir yangi modul (masalan: Invoice, Inventory, Procurement) **shu 7 qadamdan o'tadi**:

1. **PRD bo'limi yozish** — `PRD.md` ga Bosqich `N` qo'shiladi: maqsad, acceptance criteria, schema, endpointlar, frontend komponentlar, DoD.
2. **Foydalanuvchidan tasdiq olish** — "Quyidagi rejani tasdiqlaysizmi?" — javob bo'lmaguncha kod yozilmaydi.
3. **Schema o'zgarishi (atomic)** — bitta `prisma db push` bilan barcha kerakli model/maydon qo'shiladi, mavjud modellar buzilmaydi.
4. **Backend route fayli (mustaqil)** — `routes/<module>.js`, shared `prisma` va `_schemas.js` ishlatadi, mavjud routelarga tegmaydi.
5. **`app.js` ga mount** — bitta qator (`app.use('/api/<module>', requireAuth, ...)`)
6. **Frontend page (mustaqil)** — `pages/<Module>.jsx`, shared `api`, `fmt`, `useModalKeys`/`useInlineForm` ishlatadi.
7. **Test + DoD** — `tests/<module>.test.mjs`, manual QA, `TEXNIK_VAZIFA.md` yangilash.

### 3C.2 "Minimal ta'sir" qoidalari

| Qoida | Sabab |
|-------|-------|
| Yangi modul **mavjud route ga tegmaydi** — faqat qo'shadi | Regressionlardan saqlanish |
| Schema da `optional` (`?`) maydon qo'shiladi, majburiy emas | Mavjud ma'lumotlar buzilmaydi |
| Yangi sidebar nav element **oxiriga** qo'shiladi, tartib o'zgarmaydi | UX barqarorligi |
| Yangi env variable optional (`process.env.X || default`) | Eski `.env` ishlasin |
| Migratsiya skripti **idempotent** (`upsert`, `findFirst+create`) | Qayta ishlatish xavfsiz |
| Yangi endpoint pagination patternini saqlaydi: `{ data, total, page, limit }` | Frontend Pagination komponentini qayta ishlatadi |
| Yangi modul `requireAuth` middleware bilan default himoyalanadi | Xavfsizlik birinchi |

### 3C.3 Tasdiq protokoli (har katta qadam oldidan)

Quyidagi vaziyatlarda **foydalanuvchi tasdig'i majburiy**:

- Yangi model qo'shish yoki mavjud model maydonini olib tashlash
- Mavjud endpoint API shaklini o'zgartirish (breaking change)
- Mavjud frontend sahifani 30%+ qayta yozish
- `package.json` ga yangi dependency qo'shish
- `.env` ga yangi majburiy variable qo'shish
- `git rm --cached`, `prisma migrate reset` kabi destructive amallar

**Tasdiq formati:**
```
[REJA]
- Nima qilamiz: ...
- Nima o'zgaradi: ...
- Risk: ...
- Rollback: ...

Tasdiqlaysizmi? [ha/yo'q/o'zgartirish]
```

### 3C.4 Modul mustaqilligi misoli

```
✅ TO'G'RI: Yangi `Invoice` modulini qo'shish:
  - prisma/schema.prisma da Invoice modeli qo'shiladi (mavjud modellar tegmaydi)
  - routes/invoices.js yaratiladi
  - app.js ga bitta qator qo'shiladi
  - frontend/src/pages/Invoices.jsx yaratiladi
  - Sidebar nav ga "Fakturalar" qo'shiladi
  - Mavjud Contracts/Sales/Payments kodi tegmaydi

❌ NOTO'G'RI: Invoice qo'shish uchun Sale modelini o'zgartirish
  - Yarim feature kelajakda boshqa joyda yiqilishga olib keladi
  - Test coverage to'g'ri ishlamaydi
  - Migratsiya murakkab bo'ladi
```

---

## 4. PRD — Bosqich 15: User Management va RBAC (P1)

### 4.1 Maqsad
Admin foydalanuvchilarni boshqaradi (CRUD). Sotuvchilar faqat ko'rish + o'z amallarini bajaradi. Har bir o'zgarish `AuditLog` ga yoziladi.

### 4.2 Schema qo'shimchalari

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // "create" | "update" | "delete"
  entityType String   // "client" | "sale" | "payment" | ...
  entityId   String?
  payload    Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([userId, createdAt])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### 4.3 Backend
- `routes/users.js` — admin-only CRUD (`requireRole('admin')`).
- `middleware/auditLogger.js` — `req.user` + `req.method` asosida avtomatik log.

### 4.4 RBAC qoidalar

| Resurs | Admin | Seller |
|--------|-------|--------|
| Users | full CRUD | — |
| Settings | full | read only |
| Clients | full CRUD | create/read/update (delete yo'q) |
| Products | full CRUD | read only |
| Sales | full CRUD | create/read (faqat o'ziniki edit/delete) |
| Payments | full CRUD | create/read |
| Reports | full | full |

### 4.5 Frontend
- `pages/Users.jsx` — sidebar da faqat admin ga ko'rinadi.
- Sidebar nav `user.role` ga qarab filtrlash.

### 4.6 Estimated effort: ~2 ish kun

---

## 5. PRD — Bosqich 16: Advanced Reporting (P2)

### 5.1 PDF hisobotlar
- Davr bo'yicha savdo (boshlanish/tugash sanasi)
- Mijoz bo'yicha to'liq tarix (savdo + to'lov + qarz balansi)
- Qarzdorlar reyestri
- Mahsulot bo'yicha hisobot

### 5.2 Dashboard yangi widgetlar
- Top 5 mahsulot (donut chart)
- Sotuvchi reyting (oylik)
- Kecha vs bugun solishtirish

### 5.3 Yangi endpointlar
```
GET /api/reports/sales-by-period?from=&to=
GET /api/reports/client-statement/:clientId
GET /api/reports/debtors
GET /api/reports/products-top?limit=10&period=30d
```

### 5.4 Estimated effort: ~2 ish kun

---

## 6. PRD — Bosqich 17: Mobile Optimization & PWA (P2)

### 6.1 Responsive dizayn
- Tailwind breakpoints: `sm`/`md`/`lg`/`xl`
- Sidebar mobile da hamburger menu
- Jadvallar mobile da karta ko'rinishi
- Touch-friendly (min 44px tap target)

### 6.2 PWA
- `vite-plugin-pwa` + `manifest.json`
- Service worker (Workbox) — static + API GET cache
- Offline: GET lar cache dan, POST/PUT queue da

### 6.3 Estimated effort: ~3 ish kun

---

## 7. Implementation Timeline

| Bosqich | Mavzu | Priority | Vaqt | Boshlash sharti |
|---------|-------|----------|------|------------------|
| **14**  | JWT Authentication | **P0** | 1 kun  | — (darhol) |
| **14b** | Shartnomalar moduli (Spec, PDF/Excel) | **P0** | 3-4 kun | 14 (yoki parallel branch) |
| **14c** | Savdolar inline form + Spec link | **P0** | 1 kun  | 14b tugashi |
| **15**  | User Mgmt + RBAC + Audit | **P1** | 2 kun | 14 tugashi |
| **16**  | Advanced Reporting (PDF) | **P2** | 2 kun | 14b tugashi |
| **17**  | Mobile + PWA | **P2** | 3 kun | 14 tugashi |
| 18      | Real-time (SSE) | P3 | 3 kun | 14 tugashi |
| 19      | Backup/restore drill | P2 | 1 kun | 14 tugashi |

**Tavsiya etilgan ketma-ketlik (5-6 hafta):**
```
Hafta 1:    Bosqich 14   (JWT Authentication)
Hafta 2-3:  Bosqich 14b  (Contracts + Specifications + Export)
Hafta 3:    Bosqich 14c  (Sales inline form + spec linkage)
Hafta 4:    Bosqich 15   (RBAC + Audit)
Hafta 5:    Bosqich 16   (Reporting)
Hafta 6:    Bosqich 17   (Mobile/PWA)
```

---

## 8. Technical Constraints

### 8.1 Saqlanishi kerak bo'lgan patternlar

1. **CommonJS backend** — `require()`, `import` emas.
2. **Shared Prisma** — `require('../prisma')`, yangi `PrismaClient()` yo'q.
3. **Markazlashgan Zod** — barcha schema `routes/_schemas.js` da.
4. **Markazlashgan error middleware** — `next(e)` chaqirish, `e.message` qaytarmaslik.
5. **Shared axios** — `api.get(...)`, `axios.get(...)` yo'q.
6. **`fmt()` helper** — `n.toLocaleString()` qo'lda yozilmasin.
7. **`useModalKeys`** — yangi modal qo'lda hook bog'lamasin.
8. **`VITE_API_URL`** — hardcode URL yo'q.
9. **Visibility-aware polling** — `document.hidden` da `clearInterval`.
10. **Pagination format** — `{ data, total, page, limit }`.

### 8.2 Breaking change lardan saqlanish

- `/api/health` himoyalanmasin — uptime checker sinadi.
- `Setting.data` JSON blob strukturasi o'zgarmasin.
- Test suite har bosqichda o'tishi kerak.
- PM2 ecosystem.config.js o'zgarmasin.

### 8.3 Performance budget

- API response `< 300ms` (p95)
- Frontend bundle `< 500 KB` gzip
- Dashboard initial load `< 1s` LAN da

---

## 9. Risk Register

| Risk | Ehtimollik | Ta'sir | Mitigation |
|------|------------|--------|------------|
| `JWT_SECRET` git ga commit bo'lishi | O'rta | Yuqori | `.gitignore`, `.env.example` |
| Existing test lar JWT dan keyin buzilishi | Yuqori | O'rta | `tests/helpers/auth.js` global setup |
| LocalStorage XSS | Past | Yuqori | helmet CSP; kelajakda httpOnly cookie |
| Seed parol "Admin123!" production da qolishi | O'rta | Yuqori | Birinchi login da forced password change (Bosqich 15) |

---

## 10. Definition of Done — Bosqich 14

Quyidagi barcha bandlar bajarilsa, Bosqich 14 yopilgan:

- [ ] `User` modeli schema da, `prisma db push` o'tdi
- [ ] `npx prisma generate` ishlatildi
- [ ] `bcryptjs`, `jsonwebtoken` `package.json` da
- [ ] `JWT_SECRET` `.env` da (min 64 hex char), `.env.example` da placeholder
- [ ] `backend/lib/auth.js` mavjud
- [ ] `backend/middleware/authMiddleware.js` mavjud
- [ ] `backend/routes/auth.js` mavjud
- [ ] Barcha business route `requireAuth` bilan o'ralgan
- [ ] `/api/health` va `/api/auth/login` ochiq qolgan
- [ ] `scripts/seed-users.js` orqali admin yaratilgan
- [ ] `frontend/src/lib/auth.js` mavjud
- [ ] `frontend/src/lib/api.js` request interceptor Bearer token qo'shadi
- [ ] 401 da avtomatik `/login` ga yo'naltirish
- [ ] `frontend/src/pages/Login.jsx` mavjud
- [ ] `frontend/src/components/PrivateRoute.jsx` mavjud
- [ ] `App.jsx` Layout/Routes refactor qilingan
- [ ] TopHeader da user info + logout tugmasi
- [ ] Test suite yangilangan (auth helper), `npm test` o'tadi
- [ ] Manual QA: tokensiz `curl` → 401, login → token, token bilan → 200
- [ ] `TEXNIK_VAZIFA.md` Bosqich 14 `DONE ✅`
- [ ] Git commit: `feat(auth): JWT authentication (Bosqich 14)`

---

## 11. Appendix — Fayl strukturasi (Bosqich 14 dan keyin)

```
backend/
├── app.js                        ← updated (auth routes + middleware)
├── server.js
├── prisma.js
├── prisma/
│   └── schema.prisma             ← updated (User model)
├── lib/
│   └── auth.js                   ← NEW
├── middleware/
│   └── authMiddleware.js         ← NEW
├── routes/
│   ├── _schemas.js               ← updated (login, user schemas)
│   ├── auth.js                   ← NEW
│   ├── clients.js
│   ├── products.js
│   ├── contracts.js
│   ├── sales.js
│   ├── payments.js
│   ├── interactions.js
│   ├── dashboard.js
│   ├── settings.js
│   └── health.js
├── scripts/
│   ├── backup.ps1
│   └── seed-users.js             ← NEW
└── tests/
    └── helpers/
        └── auth.js               ← NEW

frontend/src/
├── App.jsx                       ← updated (Layout + PrivateRoute)
├── lib/
│   ├── api.js                    ← updated (request interceptor)
│   ├── auth.js                   ← NEW
│   └── format.js
├── components/
│   ├── Pagination.jsx
│   └── PrivateRoute.jsx          ← NEW
├── pages/
│   ├── Login.jsx                 ← NEW
│   ├── Clients.jsx
│   ├── Products.jsx
│   ├── Sales.jsx
│   ├── Payments.jsx
│   ├── Interactions.jsx
│   └── Settings.jsx
└── hooks/
    └── useModalKeys.js
```

---

## 12. Appendix — Fayl strukturasi (Bosqich 14b + 14c dan keyin)

```
backend/
├── app.js                        ← updated (contracts, specs, export mount)
├── server.js
├── prisma.js
├── prisma/
│   └── schema.prisma             ← updated (Contract+, Specification, SpecProduct, Sale.specId)
├── lib/
│   ├── auth.js
│   └── vat.js                    ← NEW (VAT_RATE, calcVat, calcRowTotal)
├── middleware/
│   └── authMiddleware.js
├── routes/
│   ├── _schemas.js               ← updated (specSchema, specProductSchema, contractSchema+)
│   ├── auth.js
│   ├── clients.js
│   ├── products.js
│   ├── contracts.js              ← rewritten (aggregate + next-number)
│   ├── specs.js                  ← NEW
│   ├── export.js                 ← NEW (PDF + Excel)
│   ├── sales.js                  ← updated (specId support)
│   ├── payments.js
│   ├── interactions.js
│   ├── dashboard.js
│   ├── settings.js
│   └── health.js
├── scripts/
│   ├── backup.ps1
│   ├── seed-users.js
│   └── backfill-contract-numeric.js  ← NEW
└── tests/
    ├── contracts.test.mjs        ← updated (aggregate)
    ├── specs.test.mjs            ← NEW
    └── helpers/
        └── auth.js

frontend/src/
├── App.jsx
├── lib/
│   ├── api.js
│   ├── auth.js
│   ├── format.js
│   └── vat.js                    ← NEW (VAT_RATE, calcVat, calcRowTotal)
├── components/
│   ├── Pagination.jsx
│   ├── PrivateRoute.jsx
│   ├── ContractForm.jsx          ← NEW (inline accordion)
│   ├── ContractRow.jsx           ← NEW (row + expand)
│   ├── SpecForm.jsx              ← NEW
│   ├── SaleForm.jsx              ← NEW (inline)
│   └── QuickAddClientModal.jsx   ← NEW
├── pages/
│   ├── Login.jsx
│   ├── Clients.jsx
│   ├── Products.jsx
│   ├── Contracts.jsx             ← rewritten (inline + expand)
│   ├── Sales.jsx                 ← rewritten (inline form)
│   ├── Payments.jsx
│   ├── Interactions.jsx
│   └── Settings.jsx              ← updated (autoContractNumbering, vatRate)
└── hooks/
    ├── useModalKeys.js
    └── useInlineForm.js          ← NEW
```

---

## 13. Yangilangan to'liq Prisma Schema (Bosqich 14 + 14b + 14c dan keyin)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {                              // Bosqich 14
  id           String    @id @default(uuid())
  username     String    @unique
  passwordHash String
  fullName     String
  role         String    @default("seller")
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([username])
  @@index([role])
}

model Client {
  id        String   @id @default(uuid())
  name      String
  inn       String   @unique
  category  String?
  status    String?
  director  String?
  phone     String?
  address   String?
  account   String?
  mfo       String?
  seller    String?
  createdAt DateTime @default(now())
  contracts Contract[]
  sales     Sale[]
  payments  Payment[]
  interactions Interaction[]

  @@index([seller])
  @@index([createdAt])
}

model Product {
  id           String        @id @default(uuid())
  article      String        @unique
  density      Float
  length       Float
  width        Float
  thickness    Float
  sqmPerPce    Float
  cbmPerPce    Float
  kgPerPce     Float
  priceTon     Float         @default(0)
  priceCbm     Float         @default(0)
  priceSqm     Float         @default(0)
  createdAt    DateTime      @default(now())
  saleProducts SaleProduct[]
  specProducts SpecProduct[]   // YANGI (14b)
}

model Contract {                          // KENGAYTIRILDI (14b)
  id             String          @id @default(uuid())
  number         String                                  // "26-01"
  numericPart    Int                                     // 1 (auto-numbering uchun)
  yearPart       Int                                     // 26
  date           DateTime
  totalValue     Float
  notes          String?                                  // YANGI
  status         String          @default("yangi")        // YANGI: yangi|amalda|yopilgan
  specCounter    Int             @default(0)              // YANGI (audit)
  clientId       String
  client         Client          @relation(fields: [clientId], references: [id])
  sales          Sale[]
  payments       Payment[]
  specifications Specification[]                          // YANGI
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt               // YANGI

  @@unique([number, clientId])
  @@unique([yearPart, numericPart])                       // YANGI — qayta ishlatilmaslik
  @@index([clientId])
  @@index([status])
  @@index([date])
}

model Specification {                     // YANGI MODEL (14b)
  id          String        @id @default(uuid())
  number      Int                                         // 1, 2, 3... shartnoma ichida
  date        DateTime      @default(now())
  totalValue  Float         @default(0)
  notes       String?
  contractId  String
  contract    Contract      @relation(fields: [contractId], references: [id], onDelete: Cascade)
  products    SpecProduct[]
  sales       Sale[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([contractId, number])
  @@index([contractId])
  @@index([date])
}

model SpecProduct {                       // YANGI MODEL (14b)
  id            String        @id @default(uuid())
  specId        String
  productId     String
  unit          String                                    // kv.m | kub.m | kg
  quantity      Float
  unitPriceVat  Float                                     // QQS bilan birlik narx
  vatAmount     Float                                     // QQS summasi (12%)
  rowTotal      Float                                     // quantity × unitPriceVat
  spec          Specification @relation(fields: [specId],    references: [id], onDelete: Cascade)
  product       Product       @relation(fields: [productId], references: [id])
  createdAt     DateTime      @default(now())

  @@index([specId])
  @@index([productId])
}

model Sale {                              // KENGAYTIRILDI (14c)
  id           String         @id @default(uuid())
  date         DateTime
  nakladnoy    String
  sellerName   String
  transportNum String?
  totalAmount  Float
  clientId     String
  contractId   String?                                    // OPTIONAL bo'ldi (14c)
  specId       String?                                    // YANGI (14c)
  client       Client         @relation(fields: [clientId],   references: [id])
  contract     Contract?      @relation(fields: [contractId], references: [id])
  spec         Specification? @relation(fields: [specId],     references: [id])
  products     SaleProduct[]
  createdAt    DateTime       @default(now())

  @@index([clientId, date])
  @@index([contractId])
  @@index([specId])                                       // YANGI
}

model SaleProduct {
  id           String  @id @default(uuid())
  saleId       String
  productId    String
  packType     Int
  totalPieces  Int
  totalCbm     Float
  totalKg      Float
  totalSqm     Float
  priceCbm     Float
  rowAmount    Float
  sale         Sale    @relation(fields: [saleId],    references: [id], onDelete: Cascade)
  product      Product @relation(fields: [productId], references: [id])

  @@index([saleId])
  @@index([productId])
}

model Payment {
  id          String    @id @default(uuid())
  date        DateTime
  amount      Float
  note        String?
  isFromExcel Boolean   @default(false)
  clientId    String
  contractId  String?
  client      Client    @relation(fields: [clientId],   references: [id])
  contract    Contract? @relation(fields: [contractId], references: [id])
  createdAt   DateTime  @default(now())

  @@index([clientId, date])
  @@index([contractId])
}

model Interaction {
  id        String   @id @default(uuid())
  date      DateTime
  type      String
  note      String
  nextDate  DateTime?
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  createdAt DateTime @default(now())

  @@index([clientId])
  @@index([nextDate])
}

model Setting {
  id        String   @id @default("global")
  data      String                                        // JSON blob — autoContractNumbering, vatRate, ... shu yerda
  updatedAt DateTime @updatedAt
}
```

**`Setting.data` JSON sxemasi (Bosqich 14b dan keyin):**

```json
{
  "companyName": "...",
  "companyAddress": "...",
  "companyInn": "...",
  "companyPhone": "...",
  "companyBank": "...",
  "companyMfo": "...",
  "companyAccount": "...",
  "sellers": ["..."],

  "autoContractNumbering": true,
  "contractNumberPrefix": "year",
  "vatRate": 0.12
}
```

---

## 14. Yangilangan endpoint ro'yxati (barcha — mavjud + yangi)

Quyidagi jadval Bosqich 14 + 14b + 14c dan keyingi to'liq API kontraktini tasvirlaydi.

| Modul | Metod | Yo'l | Auth | Status | Izoh |
|-------|-------|------|------|--------|------|
| **Auth (14)** | POST | `/api/auth/login` | — | YANGI | `{username,password}` → `{token,user}` |
|  | GET  | `/api/auth/me` | Bearer | YANGI | Joriy foydalanuvchi |
|  | POST | `/api/auth/logout` | Bearer | YANGI | (server-side noop, frontend `clearAuth`) |
| **Health** | GET | `/api/health` | — | mavjud | DB ping |
| **Clients** | GET | `/api/clients` | Bearer | mavjud | pagination, debt aggregate |
|  | POST | `/api/clients` | Bearer | mavjud | Zod |
|  | PUT | `/api/clients/:id` | Bearer | mavjud | Zod |
|  | DELETE | `/api/clients/:id` | Bearer | mavjud | |
| **Products** | GET | `/api/products` | Bearer | mavjud | pagination |
|  | POST | `/api/products` | Bearer | mavjud | Zod |
|  | PUT | `/api/products/bulk-price` | Bearer | mavjud | `$transaction` |
|  | PUT | `/api/products/:id` | Bearer | mavjud | |
|  | DELETE | `/api/products/:id` | Bearer | mavjud | |
| **Contracts (14b)** | GET | `/api/contracts` | Bearer | **REWRITTEN** | pagination + aggregate (`paidAmount`, `deliveredAmount`, `specCount`, `invoiceAmount`, `status`) |
|  | GET | `/api/contracts/next-number` | Bearer | **YANGI** | `{ number: "26-05", yearPart, numericPart }` |
|  | GET | `/api/contracts/:id` | Bearer | **YANGI** | + specifications + per-spec `deliveredAmount` |
|  | POST | `/api/contracts` | Bearer | **UPDATED** | auto/manual numbering, `notes`, `status` |
|  | PUT | `/api/contracts/:id` | Bearer | mavjud | `number` o'zgartirilmaydi |
|  | DELETE | `/api/contracts/:id` | Bearer | mavjud | linked → 409 |
|  | GET | `/api/contracts/:id/pdf` | Bearer | **YANGI** | 2-sahifa PDF |
|  | GET | `/api/contracts/:id/excel` | Bearer | **YANGI** | 2-sheet Excel |
| **Specifications (14b)** | GET | `/api/specs?contractId=` | Bearer | **YANGI** | |
|  | POST | `/api/specs` | Bearer | **YANGI** | auto-number = `MAX(spec.number)+1` |
|  | PUT | `/api/specs/:id` | Bearer | **YANGI** | mahsulot qatorlari to'liq almashtiriladi |
|  | DELETE | `/api/specs/:id` | Bearer | **YANGI** | bog'langan Sale bo'lsa 409 |
| **Sales (14c)** | GET | `/api/sales` | Bearer | **UPDATED** | response da `contract.number`, `spec.number` |
|  | GET | `/api/sales/:id` | Bearer | mavjud | |
|  | POST | `/api/sales` | Bearer | **UPDATED** | `specId` qabul qiladi, `contractId` Spec dan oladi |
|  | DELETE | `/api/sales/:id` | Bearer | mavjud | |
| **Payments** | GET | `/api/payments` | Bearer | mavjud | pagination, filter |
|  | POST | `/api/payments` | Bearer | mavjud | |
|  | DELETE | `/api/payments/:id` | Bearer | mavjud | |
| **Interactions** | GET | `/api/interactions` | Bearer | mavjud | pagination |
|  | POST | `/api/interactions` | Bearer | mavjud | |
|  | PUT | `/api/interactions/:id` | Bearer | mavjud | |
|  | DELETE | `/api/interactions/:id` | Bearer | mavjud | |
| **Dashboard** | GET | `/api/dashboard` | Bearer | mavjud | SQL aggregation |
| **Settings** | GET | `/api/settings` | Bearer | **UPDATED** | response da `autoContractNumbering`, `vatRate` |
|  | PUT | `/api/settings` | Bearer | **UPDATED** | yangi maydonlarni qabul qiladi |
| **Users (15)** | GET | `/api/users` | Bearer+admin | rejada | |
|  | POST | `/api/users` | Bearer+admin | rejada | |
|  | PUT | `/api/users/:id` | Bearer+admin | rejada | |
|  | DELETE | `/api/users/:id` | Bearer+admin | rejada | |

---

## 15. Definition of Done — yig'ma checklist

### Bosqich 14b (Contracts moduli) — BAJARILDI ✅

- [x] Schema: Contract kengaytirildi, Specification + SpecProduct yaratildi, Sale.specId qo'shildi
- [x] `prisma db push` + `prisma generate` o'tdi
- [x] `scripts/backfill-contract-numeric.js` skripti yozildi (mavjud shartnomalar uchun yearPart/numericPart)
- [x] `lib/vat.js` (backend va frontend) yaratildi, `VAT_RATE = 0.12`
- [x] `routes/_schemas.js` ga `specSchema`, `specProductSchema` qo'shildi; `contractSchema` kengaytirildi
- [x] `routes/contracts.js` qayta yozildi: pagination + aggregate (`paidAmount`, `deliveredAmount`, `specCount`)
- [x] `routes/contracts.js` da `/next-number` va `/:id` (full detail) endpointlari mavjud
- [x] `routes/specs.js` yaratildi: GET, POST, PUT, DELETE (transaction bilan)
- [x] `routes/export.js` yaratildi: `/api/contracts/:id/pdf` (2 sahifa), `/api/contracts/:id/excel` (2 sheet)
- [ ] `app.js` ga barcha yangi router `requireAuth` bilan mount qilindi ← Bosqich 14 (JWT) dan keyin
- [x] `package.json` ga `pdfkit`, `exceljs` qo'shildi
- [x] `useInlineForm` hook yaratildi (frontend)
- [x] `Contracts.jsx` qayta yozildi: 12 ustun, expand, inline accordion form
- [x] `ContractForm`, `SpecForm`, `ContractRow` komponentlari mavjud
- [x] Auto-numbering checkbox ishlaydi (Settings + ContractForm)
- [x] PDF/Excel yuklab olish ishlaydi (blob response)
- [x] `TEXNIK_VAZIFA.md` Bosqich 14b `DONE ✅`

### Bosqich 14c (Sales inline + Spec link) — BAJARILDI ✅

- [x] `saleSchema` da `specId` optional, `contractId` optional
- [x] `routes/sales.js` POST `specId` qabul qiladi, `contractId` ni Spec dan oladi
- [x] `routes/sales.js` GET response da `contract.number`, `spec.number` bor
- [x] `Sales.jsx` modal yo'q, accordion inline forma bor (`useInlineForm`)
- [x] `SaleForm` — mijoz → shartnoma → spets cascade (prevRef pattern bilan)
- [x] Spets tanlanganda mahsulotlar prefill bo'ladi
- [x] Ro'yxatda yangi ustunlar: `Shartnoma raqami`, `Spets №`
- [x] Spec dan "Savdo" tugmasi bosilganda Sales sahifaga navigate qilib forma prefill bo'ladi
- [x] `TEXNIK_VAZIFA.md` Bosqich 14c `DONE ✅`

