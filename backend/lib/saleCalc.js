// Savdo qatori summasi va fizik qiymatlarini SERVER tomonda hosil qiladi (C-2).
// Ishonchli kirishlar: unit, amount, price, packType + mahsulot o'lchamlari.
// Frontend `Sales.jsx` calculateRowValues bilan bit-aniq bir xil yaxlitlash —
// aks holda tahrirlashda jami o'zgarib ketadi.

function computeSaleRow({ unit, amount, price, packType = 1 }, product) {
  const qty = Number(amount) || 0;
  const unitPrice = Number(price) || 0;
  const rowAmount = Math.round(qty * unitPrice);

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
