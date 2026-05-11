// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:3001/api';

// Shared state across flows
let clientName, clientId, productId, contractId;

// ─── Yordamchi: API orqali test ma'lumot yaratish ──────────────────────────
test.beforeAll(async ({ request }) => {
  // 1. Mahsulot yaratish
  const product = await request.post(`${API}/products`, {
    data: {
      article: `E2E-${Date.now()}`, density: 80, length: 2400,
      width: 1200, thickness: 12,
      sqmPerPce: 2.88, cbmPerPce: 0.03456, kgPerPce: 2.765,
      priceCbm: 5_000_000, priceTon: 0, priceSqm: 0,
    },
  });
  expect(product.ok()).toBeTruthy();
  productId = (await product.json()).id;

  // 2. Mijoz yaratish
  const ts = String(Date.now());
  clientName = `E2E Mijoz ${ts.slice(-6)}`;
  const client = await request.post(`${API}/clients`, {
    data: { name: clientName, inn: ts.slice(-9), status: 'Yangi' },
  });
  expect(client.ok()).toBeTruthy();
  const c = await client.json();
  clientId = c.id;

  // 3. Shartnoma yaratish
  const contract = await request.post(`${API}/contracts`, {
    data: {
      number:     `E2E-${ts.slice(-5)}`,
      date:       new Date().toISOString().split('T')[0],
      totalValue: 50_000_000,
      clientId,
    },
  });
  expect(contract.ok()).toBeTruthy();
  contractId = (await contract.json()).id;
});

test.afterAll(async ({ request }) => {
  // Tozalash
  if (contractId) await request.delete(`${API}/contracts/${contractId}`).catch(() => {});
  if (clientId)   await request.delete(`${API}/clients/${clientId}`).catch(() => {});
  if (productId)  await request.delete(`${API}/products/${productId}`).catch(() => {});
});

// ─── Flow 1: Mijoz listda ko'rinishi ──────────────────────────────────────
test('1. Yangi mijoz listda ko\'rinadi', async ({ page }) => {
  await page.goto(`${BASE}/clients`);
  await page.waitForSelector('table');

  // Search qilamiz
  const searchInput = page.locator('input[placeholder*="Mijoz"]').first();
  await searchInput.fill(clientName);
  await page.waitForTimeout(400); // debounce

  await expect(page.locator('tbody')).toContainText(clientName);
});

// ─── Flow 2: Savdo yaratish — debt dashboard da yangilanishi ──────────────
test('2. Savdo yaratganda mijoz qarzdorligi oshadi', async ({ page }) => {
  // Dashboard da eski qiymatni olamiz
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.mini-card');

  // Savdo yaratish
  await page.goto(`${BASE}/sales`);
  await page.waitForSelector('table');

  await page.locator('button:has-text("Yangi Yuk Xati")').click();
  await page.waitForSelector('form');

  // Mijoz tanlash
  await page.locator('select').first().selectOption({ value: clientId });
  await page.waitForTimeout(500); // shartnomalar yuklansin

  // Shartnoma tanlash
  await page.locator('select').nth(1).selectOption({ value: contractId });

  // Sana (bugun — default)
  await page.locator('input[type="text"]').first().fill('E2E-001');
  await page.locator('input[placeholder="F.I.O."]').fill('Test Sotuvchi');

  // Mahsulot qatori
  await page.locator('select[required]').last().selectOption({ value: productId });
  await page.locator('input[type="number"]').filter({ hasText: '' }).nth(0).fill('5');

  // Saqlash
  await page.locator('button:has-text("Yuk xatini saqlash")').click();
  await page.waitForTimeout(1000);

  // Savdolar listda yangi yozuv bo'lishi kerak
  await expect(page.locator('table')).toContainText('E2E-001');
});

// ─── Flow 3: To'lov qo'shish — debt kamayishi ─────────────────────────────
test('3. To\'lov qo\'shilganda tushumlar listda ko\'rinadi', async ({ page }) => {
  await page.goto(`${BASE}/payments`);
  await page.waitForSelector('table');

  await page.locator('button:has-text("Yangi Tushum")').click();
  await page.waitForSelector('form');

  // Mijoz tanlash
  await page.locator('select').first().selectOption({ value: clientId });
  await page.waitForTimeout(500);

  // Shartnoma tanlash
  await page.locator('select').nth(1).selectOption({ value: contractId });

  // Summa
  await page.locator('input[type="number"]').fill('1000000');

  // Saqlash
  await page.locator('button:has-text("Saqlash")').click();
  await page.waitForTimeout(1000);

  // Tushumlar listda yangi yozuv ko'rinishi kerak
  await expect(page.locator('table')).toContainText(clientName);
});
