import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtDate, setFormatLocale } from './format.js';

test('fmt — locale bo\'yicha guruhlash', () => {
  setFormatLocale('zh-CN');
  assert.equal(fmt(1234567), '1,234,567');          // zh-CN → vergul
  setFormatLocale('ru-RU');
  assert.notEqual(fmt(1234567), '1,234,567');        // ru-RU → bo'sh joy (vergul emas)
  assert.equal(fmt(0), '0');
  assert.equal(fmt(null), '0');
});

test('fmtDate — locale bo\'yicha maydon tartibi', () => {
  const d = new Date(2026, 2, 12); // 12-mart-2026 (lokal vaqt, TZ-xavfsiz)
  setFormatLocale('zh-CN');
  assert.match(fmtDate(d), /^2026/);                  // zh → yil oldinda
  setFormatLocale('ru-RU');
  assert.match(fmtDate(d), /^12/);                    // ru → kun oldinda
  setFormatLocale('uz-UZ');
});

test('fmtDate — yaroqsiz/bo\'sh sana → tire', () => {
  assert.equal(fmtDate(null), '—');
  assert.equal(fmtDate(''), '—');
  assert.equal(fmtDate('invalid'), '—');              // RangeError bermasligi kerak
});
