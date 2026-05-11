import { execSync } from 'child_process';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/erp_test_db?connection_limit=5&pool_timeout=10';

export async function setup() {
  console.log('\n[test] Test DB tayorlanmoqda...');
  try {
    execSync('npx prisma db push --force-reset', {
      env:   { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd:   process.cwd(),
      stdio: 'pipe',
    });
    console.log('[test] erp_test_db tayyor.');
  } catch (e) {
    console.warn('[test] DB push xatosi — erp_test_db mavjudmi?\n', e.stderr?.toString() || e.message);
  }
}

export async function teardown() {}
