import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
} catch {
  // no .env (e.g. CI) — rely on real env vars
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'haupcar-uploads-'));
// Test files log in many times from one IP; the rate-limit test lowers this itself.
process.env.AUTH_RATE_LIMIT = '1000';
