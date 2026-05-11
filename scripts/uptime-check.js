#!/usr/bin/env node
// Uptime monitor — /api/health ni har 5 daqiqada tekshiradi
// Ishga tushirish: node scripts/uptime-check.js
// .env da kerakli o'zgaruvchilar:
//   HEALTH_URL=http://localhost:3001/api/health
//   TELEGRAM_BOT_TOKEN=<bot token>
//   TELEGRAM_CHAT_ID=<chat id>

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const https = require('https');
const http  = require('http');

const HEALTH_URL = process.env.HEALTH_URL || 'http://localhost:3001/api/health';
const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;
const INTERVAL   = 5 * 60 * 1000; // 5 daqiqa

let lastStatus = 'unknown';

function notify(msg) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[uptime] Telegram sozlanmagan —', msg);
    return;
  }
  const text   = encodeURIComponent(msg);
  const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}`;
  https.get(apiUrl, () => {}).on('error', () => {});
}

function check() {
  const lib = HEALTH_URL.startsWith('https') ? https : http;
  const req = lib.get(HEALTH_URL, { timeout: 8000 }, (res) => {
    const ok = res.statusCode === 200;
    if (!ok && lastStatus !== 'down') {
      const msg = `🔴 ERP server YIQILDI! ${HEALTH_URL} → ${res.statusCode}`;
      console.error(new Date().toISOString(), msg);
      notify(msg);
      lastStatus = 'down';
    } else if (ok && lastStatus === 'down') {
      const msg = `🟢 ERP server qayta ishlamoqda. ${HEALTH_URL}`;
      console.log(new Date().toISOString(), msg);
      notify(msg);
      lastStatus = 'up';
    } else if (ok) {
      console.log(new Date().toISOString(), `[uptime] OK — ${HEALTH_URL}`);
      lastStatus = 'up';
    }
  });
  req.on('error', () => {
    if (lastStatus !== 'down') {
      const msg = `🔴 ERP server YETIB BO'LMAYDI! ${HEALTH_URL}`;
      console.error(new Date().toISOString(), msg);
      notify(msg);
      lastStatus = 'down';
    }
  });
  req.on('timeout', () => req.destroy());
}

check();
setInterval(check, INTERVAL);
console.log(`[uptime] Monitor ishga tushdi. Har ${INTERVAL / 60000} daqiqada: ${HEALTH_URL}`);
