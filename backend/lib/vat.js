const VAT_RATE = 0.12;

// totalWithVat — QQS bilan jami summa; qaytaradi QQS summasi
const calcVat = (totalWithVat) =>
  Math.round(totalWithVat / (1 + VAT_RATE) * VAT_RATE * 100) / 100;

// quantity × unitPriceVat = qator jami
const calcRowTotal = (quantity, unitPriceVat) =>
  Math.round(quantity * unitPriceVat * 100) / 100;

module.exports = { VAT_RATE, calcVat, calcRowTotal };
