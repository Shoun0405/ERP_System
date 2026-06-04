// Savdo qatori summasi va fizik qiymatlarini SERVER tomonda hosil qiladi (C-2).
// Ishonchli kirishlar: unit, amount, price, packType + mahsulot o'lchamlari.
// Frontend `Sales.jsx` calculateRowValues bilan bit-aniq bir xil yaxlitlash —
// aks holda tahrirlashda jami o'zgarib ketadi.

// rate — valyuta kursi (USD savdo uchun USD→UZS; UZS savdo uchun 1).
// Narx savdo valyutasida, DOIMO 1 tonna (1000 kg) uchun kiritiladi; pul og'irlikdan
// hisoblanadi. rowAmount/priceCbm har doim UZS (kanonik baza).
function computeSaleRow({ unit, amount, price, packType = 1 }, product, rate = 1) {
  const qty = Number(amount) || 0;
  const unitPrice = Number(price) || 0;

  let totalPieces = 0;
  let totalCbm = 0;
  let totalKg = 0;
  let totalSqm = 0;

  if (unit === 'dona') {
    totalPieces = Math.round(qty);
    totalCbm = +(totalPieces * product.cbmPerPce).toFixed(6);
    totalKg = +(totalPieces * product.kgPerPce).toFixed(3);
    totalSqm = +(totalPieces * product.sqmPerPce).toFixed(4);
  } else if (unit === 'kg') {
    totalKg = qty;
    totalPieces = product.kgPerPce > 0 ? Math.round(qty / product.kgPerPce) : 0;
    totalCbm = +(totalPieces * product.cbmPerPce).toFixed(6);
    totalSqm = +(totalPieces * product.sqmPerPce).toFixed(4);
  } else if (unit === 'kv.m') {
    totalSqm = qty;
    totalPieces = product.sqmPerPce > 0 ? Math.round(qty / product.sqmPerPce) : 0;
    totalCbm = +(totalPieces * product.cbmPerPce).toFixed(6);
    totalKg = +(totalPieces * product.kgPerPce).toFixed(3);
  } else if (unit === 'kub.m') {
    totalCbm = qty;
    totalPieces = product.cbmPerPce > 0 ? Math.round(qty / product.cbmPerPce) : 0;
    totalKg = +(totalPieces * product.kgPerPce).toFixed(3);
    totalSqm = +(totalPieces * product.sqmPerPce).toFixed(4);
  }

  // Narx 1 tonna uchun: summa = (kg / 1000) × narx × kurs.
  const rowAmount = Math.round((totalKg / 1000) * unitPrice * (Number(rate) || 1));
  const priceCbm = totalCbm > 0 ? +(rowAmount / totalCbm).toFixed(2) : 0;

  return {
    productId: product.id,
    packType: Number(packType) || 1,
    totalPieces,
    totalCbm,
    totalKg,
    totalSqm,
    priceCbm,
    rowAmount,
  };
}

module.exports = { computeSaleRow };
