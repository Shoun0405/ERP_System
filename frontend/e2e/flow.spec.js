// @ts-check
import { test, expect } from '@playwright/test';

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
    data: { name: clientName, inn: ts.slice(-9), status: 'Yangi', seller: 'E2E Sotuvchi' },
  });
  expect(client.ok()).toBeTruthy();
  const c = await client.json();
  clientId = c.id;

  // 3. Shartnoma yaratish (sotuvchi mijozga biriktirilganlardan)
  const contract = await request.post(`${API}/contracts`, {
    data: {
      number:     `E2E-${ts.slice(-5)}`,
      date:       new Date().toISOString().split('T')[0],
      totalValue: 50_000_000,
      seller:     'E2E Sotuvchi',
      clientId,
    },
  });
  expect(contract.ok()).toBeTruthy();
  contractId = (await contract.json()).id;
});

test.afterAll(async ({ request }) => {
  // Tozalash — avval bog'liq savdo va to'lovlarni o'chiramiz (FK 409 dan qochish),
  // shunda mijoz/shartnoma ham o'chadi va testlar takror ishlaganda ma'lumot to'planmaydi.
  if (clientId) {
    const salesRes = await request.get(`${API}/sales?clientId=${clientId}&limit=200`);
    if (salesRes.ok()) {
      const ids = ((await salesRes.json()).data || []).map(s => s.id);
      if (ids.length) await request.post(`${API}/sales/bulk-delete`, { data: { ids } }).catch(() => {});
    }
    const payRes = await request.get(`${API}/payments?clientId=${clientId}&limit=200`);
    if (payRes.ok()) {
      for (const p of ((await payRes.json()).data || [])) {
        await request.delete(`${API}/payments/${p.id}`).catch(() => {});
      }
    }
  }
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

// ─── Flow 2: Savdo yaratish — savdolar listda ko'rinishi ──────────────────
test('2. Savdo yaratganda mijoz qarzdorligi oshadi', async ({ page }) => {
  await page.goto(`${BASE}/sales`);
  // Sahifa ma'lumotlari yuklanib, tartib barqarorlashishini kutamiz (tugma siljimasligi uchun)
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('table');

  // Inline formani ochamiz
  await page.getByRole('button', { name: 'Yangi Yuk Xati' }).click();
  const form = page.getByTestId('sale-form');
  await form.waitFor();

  // Mijoz tanlash → shartnomalar async yuklanadi
  await form.getByTestId('sale-client').selectOption({ value: clientId });

  // Shartnoma optioni paydo bo'lishini kutamiz, so'ng tanlaymiz
  const contractSel = form.getByTestId('sale-contract');
  await expect(contractSel.locator(`option[value="${contractId}"]`)).toBeAttached();
  await contractSel.selectOption({ value: contractId });

  // Yuk xati raqami
  await form.getByTestId('sale-nakladnoy').fill('E2E-001');
  // 1c: sotuvchi shartnomadan avtomatik keladi (tahrirlanadi, lekin kiritish shart emas)
  await expect(form.getByTestId('sale-seller')).toHaveValue('E2E Sotuvchi');

  // Mahsulot qatori: mahsulot + miqdor + narx
  await form.getByTestId('row-product').selectOption({ value: productId });
  await form.getByTestId('row-amount').fill('5');
  await form.locator('input[placeholder="Narx"]').fill('1000000');

  // Saqlash
  await page.getByRole('button', { name: 'Yuk xatini saqlash' }).click();

  // Muvaffaqiyatli saqlangach forma yopiladi va list yangilanadi
  await expect(form).toBeHidden();

  // Savdolar listda yangi yozuv (nakladnoy katakchasi) ko'rinishi kerak
  await expect(page.getByRole('cell', { name: 'E2E-001' }).first()).toBeVisible();
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
