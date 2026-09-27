import { Client } from 'pg';
import * as bcrypt from 'bcrypt';

export const TEST_USERNAME = 'e2e-test-user';
export const TEST_PASSWORD = 'e2e-test-password';

export async function ensureTestUser(): Promise<void> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 12);
    await client.query(
      `INSERT INTO "user" (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [TEST_USERNAME, passwordHash],
    );
  } finally {
    await client.end();
  }
}
