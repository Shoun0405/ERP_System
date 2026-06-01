import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/erp_test_db?connection_limit=5&pool_timeout=10';

export async function setup() {
  console.log('\n[test] Test DB tayorlanmoqda...');
  const envPath = path.join(process.cwd(), '.env');
  let envBackup = null;
  
  if (fs.existsSync(envPath)) {
    envBackup = fs.readFileSync(envPath, 'utf8');
  }

  try {
    // Vaqtinchalik .env fayliga test bazasini yozamiz
    fs.writeFileSync(envPath, `DATABASE_URL="${TEST_DB_URL}"\n`);

    execSync('npx prisma db push --force-reset', {
      cwd:   process.cwd(),
      stdio: 'pipe',
    });

    // Zaxira .env ni tezda tiklaymiz
    if (envBackup) {
      fs.writeFileSync(envPath, envBackup);
    } else {
      fs.unlinkSync(envPath);
    }

    execSync('node tests/seed-test-user.js', {
      cwd:   process.cwd(),
      stdio: 'pipe',
    });
    console.log('[test] erp_test_db tayyor.');
  } catch (e) {
    // Xato bo'lsa ham .env tiklanishini ta'minlaymiz
    if (envBackup) {
      fs.writeFileSync(envPath, envBackup);
    }
    console.warn('[test] DB push xatosi — erp_test_db mavjudmi?\n', e.stderr?.toString() || e.message);
  }
}

export async function teardown() {}
