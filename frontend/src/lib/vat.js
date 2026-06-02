export const VAT_RATE = 0.12;

// totalWithVat — QQS bilan jami; rate — stavka (Sozlamalardan, default VAT_RATE)
// qaytaradi: totalWithVat ichidagi QQS summasi
export const calcVat = (totalWithVat, rate = VAT_RATE) =>
  Math.round(totalWithVat / (1 + rate) * rate * 100) / 100;

// quantity × unitPriceVat = qator jami
export const calcRowTotal = (qty, price) =>
  Math.round(qty * price * 100) / 100;
