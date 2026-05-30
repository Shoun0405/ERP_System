const { z } = require('zod');

const clientSchema = z.object({
  name:     z.string().min(1, 'Nom majburiy').max(200),
  inn:      z.string().max(30).nullable().default(null).transform(v => v || null),
  phone:    z.string().max(20).default(''),
  director: z.string().max(200).default(''),
  address:  z.string().max(500).default(''),
  category: z.string().max(100).default(''),
  status:   z.enum(['Yangi', 'Faol', 'Kutilmoqda', "Muddati o'tgan"]).default('Yangi'),
  account:  z.string().max(20).default(''),
  mfo:      z.string().max(5).default(''),
  seller:   z.string().max(200).default(''),
});

const productSchema = z.object({
  article:   z.string().min(1).max(100),
  density:   z.coerce.number().positive(),
  length:    z.coerce.number().positive(),
  width:     z.coerce.number().positive(),
  thickness: z.coerce.number().positive(),
  priceCbm:  z.coerce.number().nonnegative().default(0),
  priceTon:  z.coerce.number().nonnegative().default(0),
  priceSqm:  z.coerce.number().nonnegative().default(0),
  cbmPerPce: z.coerce.number().nonnegative().default(0),
  sqmPerPce: z.coerce.number().nonnegative().default(0),
  kgPerPce:  z.coerce.number().nonnegative().default(0),
});

const bulkPriceSchema = z.object({
  updates: z.array(z.object({
    id:       z.string().uuid(),
    priceTon: z.coerce.number().nonnegative(),
    priceCbm: z.coerce.number().nonnegative(),
    priceSqm: z.coerce.number().nonnegative(),
  })).min(1),
});

const paymentSchema = z.object({
  date:       z.string().min(1),
  amount:     z.coerce.number().positive(),
  note:       z.string().max(500).default(''),
  clientId:   z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
});

const contractSchema = z.object({
  number:     z.string().min(1).max(50).optional(),
  date:       z.string().min(1),
  totalValue: z.coerce.number().nonnegative(),
  clientId:   z.string().uuid(),
  notes:      z.string().max(2000).default(''),
  status:     z.enum(['yangi', 'amalda', 'yopilgan']).default('yangi'),
  seller:     z.string().max(200).optional().nullable().default(null).transform(v => v || null),
});

const interactionSchema = z.object({
  date:     z.string().min(1),
  type:     z.string().min(1).max(100),
  note:     z.string().max(1000).default(''),
  nextDate: z.string().nullable().default(null),
  clientId: z.string().uuid(),
});

const settingSchema = z.object({
  companyName:           z.string().max(200).default(''),
  companyAddress:        z.string().max(500).default(''),
  companyInn:            z.string().max(20).default(''),
  companyPhone:          z.string().max(20).default(''),
  companyBank:           z.string().max(200).default(''),
  companyMfo:            z.string().max(5).default(''),
  companyAccount:        z.string().max(20).default(''),
  sellers:               z.array(z.string().max(200)).default([]),
  autoContractNumbering: z.boolean().default(true),
  vatRate:               z.coerce.number().min(0).max(1).default(0.12),
});

const saleProductSchema = z.object({
  productId:   z.string().uuid(),
  packType:    z.number().int().nonnegative(),
  totalPieces: z.number().int().nonnegative(),
  totalCbm:    z.number().nonnegative(),
  totalKg:     z.number().nonnegative(),
  totalSqm:    z.number().nonnegative(),
  priceCbm:    z.number().nonnegative(),
  rowAmount:   z.number().nonnegative(),
});

const saleSchema = z.object({
  date:         z.string().refine(val => !isNaN(Date.parse(val)), { message: "Noto'g'ri sana formati" }),
  nakladnoy:    z.string().min(1),
  sellerName:   z.string().min(1),
  transportNum: z.string().nullable().default(''),
  clientId:     z.string().uuid(),
  contractId:   z.string().uuid().nullable().optional(),
  specId:       z.string().uuid().nullable().optional(),
  products:     z.array(saleProductSchema).min(1),
  facturaStatus: z.enum(['yuborildi', 'yuborilmagan']).default('yuborilmagan'),
});

const specProductSchema = z.object({
  productId:    z.string().uuid(),
  unit:         z.enum(['kv.m', 'kub.m', 'kg']),
  quantity:     z.coerce.number().positive(),
  unitPriceVat: z.coerce.number().positive(),
});

const specSchema = z.object({
  contractId: z.string().uuid(),
  date:       z.string().min(1).optional(),
  notes:      z.string().max(1000).default(''),
  products:   z.array(specProductSchema).min(1),
});

const loginSchema = z.object({
  username: z.string().min(1, 'Foydalanuvchi nomi majburiy'),
  password: z.string().min(1, 'Parol majburiy'),
});

module.exports = {
  clientSchema,
  productSchema,
  bulkPriceSchema,
  paymentSchema,
  contractSchema,
  interactionSchema,
  settingSchema,
  saleSchema,
  specSchema,
  specProductSchema,
  loginSchema,
};
