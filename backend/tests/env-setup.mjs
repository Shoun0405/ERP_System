// Test workerda DATABASE_URL ni test DB ga o'rnatish
// Bu setupFiles orqali har bir test faylidan oldin ishlaydi
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/erp_test_db?connection_limit=5&pool_timeout=10';

// C-1: lib/jwt.js majburiy kuchli sekretni talab qiladi. Test muhitida ham
// real login/verify testlari (auth.test.mjs) ishlashi uchun sekret o'rnatamiz.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-only-jwt-secret-0123456789abcdef0123456789';

// M-1: Test auth bypass endi aniq flag talab qiladi. Mavjud testlar bypass ga
// tayanadi, shuning uchun test workerda uni yoqamiz.
process.env.TEST_AUTH_BYPASS = '1';
