// @ts-check
// Playwright "setup" loyihasi: e2e admin foydalanuvchini ta'minlaydi, login qiladi
// va sessiya cookie sini storageState faylga saqlaydi. Boshqa barcha loyihalar
// (chromium) shu storageState ni meros qilib oladi — page ham, request ham autentifikatsiyalangan.
import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_DIR  = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'state.json');
const API = 'http://localhost:3001/api';

const E2E_USER = process.env.E2E_USER || 'e2e-admin';
const E2E_PASS = process.env.E2E_PASS || 'e2e-password-123';

setup('authenticate', async ({ request }) => {
  // 1. Dev bazada e2e admin mavjudligini ta'minlaymiz (idempotent)
  execSync('node scripts/seed-e2e-user.js', {
    cwd:   path.join(__dirname, '..', '..', 'backend'),
    stdio: 'inherit',
  });

  // 2. Login → httpOnly cookie request context ga o'rnatiladi
  const res = await request.post(`${API}/auth/login`, {
    data: { username: E2E_USER, password: E2E_PASS },
  });
  expect(res.ok()).toBeTruthy();

  // 3. Cookie ni storageState faylga saqlaymiz
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await request.storageState({ path: AUTH_FILE });
});
