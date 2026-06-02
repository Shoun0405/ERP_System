const { fillDocx, mapContractData, mapSpecData } = require('../lib/docExport');

// Mock settings config
const mockCfg = {
  companyName: "UZ-Tex Style LLC",
  companyInn: "123456789",
  companyAddress: "Tashkent, Chilonzor 1-kvartal, 14",
  companyPhone: "+998 71 123 45 67",
  companyAccount: "20208000900012345001",
  companyMfo: "00014",
  companyBank: "Ipak Yuli Banki",
  companyDirector: "Alimov B.A."
};

// Mock contract data
const mockContract = {
  number: "26-01",
  date: "2026-06-02T13:00:00.000Z",
  notes: "Test shartnoma izohi",
  totalValue: 12000000,
  status: "amalda",
  seller: "Kamilov S.O.",
  client: {
    name: "Mega Build Group LLC",
    inn: "987654321",
    director: "Yusupov T.R.",
    phone: "+998 90 987 65 43",
    address: "Tashkent, Yunusobod 4-daha",
    account: "20208000100098765002",
    mfo: "00440"
  }
};

// Mock specification data
const mockSpec = {
  number: "1",
  date: "2026-06-02T13:00:00.000Z",
  notes: "Birinchi yetkazib berish spetsifikatsiyasi",
  totalValue: 12000000,
  contract: mockContract,
  products: [
    {
      product: { article: "A-100" },
      unit: "kv.m.",
      quantity: 150,
      unitPriceVat: 80000,
      vatAmount: 1285714,
      rowTotal: 12000000
    }
  ]
};

console.log("Verifying template rendering...");

try {
  const contractData = mapContractData(mockContract, mockCfg);
  const contractDocx = fillDocx('contract_template.docx', contractData);
  console.log("✓ Contract template rendered successfully! Buffer length:", contractDocx.length);

  const specData = mapSpecData(mockSpec, mockCfg);
  const specDocx = fillDocx('spec_template.docx', specData);
  console.log("✓ Specification template rendered successfully! Buffer length:", specDocx.length);

  console.log("ALL TEMPLATES VERIFIED SUCCESSFULLY!");
} catch (e) {
  console.error("❌ ERROR RENDERING TEMPLATE:", e.message);
  if (e.properties && e.properties.errors) {
    console.error("Detailed docxtemplater errors:", JSON.stringify(e.properties.errors, null, 2));
  }
  process.exit(1);
}
