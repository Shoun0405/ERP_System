const VAT_RATE = 0.12;

// totalWithVat — QQS bilan jami summa; rate — stavka (Settings'dan, default VAT_RATE)
// qaytaradi: totalWithVat ichidagi QQS summasi
const calcVat = (totalWithVat, rate = VAT_RATE) =>
  Math.round(totalWithVat / (1 + rate) * rate * 100) / 100;

// quantity × unitPriceVat = qator jami
const calcRowTotal = (quantity, unitPriceVat) =>
  Math.round(quantity * unitPriceVat * 100) / 100;

module.exports = { VAT_RATE, calcVat, calcRowTotal };
