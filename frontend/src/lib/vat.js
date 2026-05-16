export const VAT_RATE = 0.12;

// totalWithVat — QQS bilan jami; qaytaradi QQS summasi
export const calcVat = (totalWithVat) =>
  Math.round(totalWithVat / (1 + VAT_RATE) * VAT_RATE * 100) / 100;

// quantity × unitPriceVat = qator jami
export const calcRowTotal = (qty, price) =>
  Math.round(qty * price * 100) / 100;
