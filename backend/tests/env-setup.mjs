// Test workerda DATABASE_URL ni test DB ga o'rnatish
// Bu setupFiles orqali har bir test faylidan oldin ishlaydi
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/erp_test_db?connection_limit=5&pool_timeout=10';
