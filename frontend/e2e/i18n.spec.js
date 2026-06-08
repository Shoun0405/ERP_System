import { test, expect } from '@playwright/test';

// Til almashtirgich: UZ → RU → ZH va qayta yuklashda saqlanishi.
// Auth holati auth.setup.js dan meros olinadi (storageState).
test('til almashtirgich — uz→ru→zh va saqlanish', async ({ page }) => {
  await page.goto('/');

  // Boshlang'ich holatda o'zbekcha nav ko'rinadi
  await expect(page.getByRole('link', { name: 'Mijozlar' })).toBeVisible();

  // RU ga o'tish
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.getByRole('link', { name: 'Клиенты' })).toBeVisible();

  // ZH ga o'tish
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.getByRole('link', { name: '客户' })).toBeVisible();

  // localStorage da saqlanishi
  const lang = await page.evaluate(() => localStorage.getItem('erp_lang'));
  expect(lang).toBe('zh');

  // Qayta yuklashdan keyin ZH qoladi
  await page.reload();
  await expect(page.getByRole('link', { name: '客户' })).toBeVisible();
});
