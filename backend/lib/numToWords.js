// Butun sonni rus tilida so'z bilan yozish (summa "prописью" uchun).
// Jins kelishigi: minglar — ayol jinsi (одна тысяча, две тысячи),
// million/milliard — erkak jinsi. 0..999 999 999 999 oralig'i.

const ONES_M = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS  = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS   = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

// triad uchun ot shakllari: [1, 2-4, 5+]
const SCALES = [
  null,
  ['тысяча', 'тысячи', 'тысяч'],
  ['миллион', 'миллиона', 'миллионов'],
  ['миллиард', 'миллиарда', 'миллиардов'],
];

function pluralForm(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

// 0..999 ni so'zga (jinsga qarab) aylantiradi
function tripletToWords(n, feminine) {
  const words = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    words.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) words.push(TENS[t]);
    if (o) words.push((feminine ? ONES_F : ONES_M)[o]);
  }
  return words;
}

function numberToWordsRu(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'ноль';

  // triadlarga ajratamiz (eng kichigidan)
  const triads = [];
  while (n > 0) {
    triads.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts = [];
  for (let i = triads.length - 1; i >= 0; i--) {
    const t = triads[i];
    if (t === 0) continue;
    const feminine = i === 1; // minglar ayol jinsi
    parts.push(...tripletToWords(t, feminine));
    if (i > 0) parts.push(pluralForm(t, SCALES[i]));
  }
  return parts.join(' ');
}

module.exports = { numberToWordsRu };
