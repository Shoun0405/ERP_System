require('dotenv').config();

// Sentry (ixtiyoriy — SENTRY_DSN .env da bo'lsa faollashadi)
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 });
    console.log('[Sentry] xato monitoring faol.');
  } catch { /* @sentry/node o'rnatilmagan — npm i @sentry/node */ }
}

const express  = require('express');
const cors     = require('cors');
const compression = require('compression');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan   = require('morgan');
const path     = require('path');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cookieParser());
app.use(compression());
app.use(helmet());

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
}

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());

app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// H-3: Login uchun qattiqroq limit — brute-force parol urinishlariga qarshi.
// Muvaffaqiyatli kirishlar hisobga olinmaydi; faqat noto'g'ri urinishlar limitlanadi.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Juda ko'p kirish urinishi. 15 daqiqadan so'ng qayta urinib ko'ring." },
});

const auth = require('./middleware/auth');

app.use('/api/health',       require('./routes/health'));
app.use('/api/auth/login',   loginLimiter);
app.use('/api/auth',         require('./routes/auth'));

app.use('/api/clients',      auth, require('./routes/clients'));
app.use('/api/products',     auth, require('./routes/products'));
app.use('/api/contracts',    auth, require('./routes/contracts'));
app.use('/api/specs',        auth, require('./routes/specs'));
app.use('/api/export',       auth, require('./routes/export'));
app.use('/api/sales',        auth, require('./routes/sales'));
app.use('/api/payments',     auth, require('./routes/payments'));
app.use('/api/interactions', auth, require('./routes/interactions'));
app.use('/api/dashboard',    auth, require('./routes/dashboard'));
app.use('/api/settings',     auth, require('./routes/settings'));
app.use('/api/users',        auth, require('./routes/users'));
app.use('/api/reports',      auth, require('./routes/reports'));

// Frontend static serve (production)
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Markazlashgan error middleware
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validatsiya xatosi', issues: err.errors });
  }
  res.status(err.status || 500).json({ error: err.publicMessage || 'Server xatosi' });
});

module.exports = app;
