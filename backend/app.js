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

const app = express();

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
}

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim());
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());

app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.use('/api/health',       require('./routes/health'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/contracts',    require('./routes/contracts'));
app.use('/api/specs',        require('./routes/specs'));
app.use('/api/export',       require('./routes/export'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/interactions', require('./routes/interactions'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/settings',     require('./routes/settings'));

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
