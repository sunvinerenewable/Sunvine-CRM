import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client, Pool } = pg;

/**
 * Safely parse a .env file without external dependencies or leaking secrets.
 */
export function loadEnvFile(envPath = path.resolve(process.cwd(), '.env')) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

/**
 * Resolve required configuration safely.
 */
export function getEnvConfig() {
  const fileEnv = loadEnvFile();

  const SUPABASE_URL = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || null;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY || null;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || null;
  const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || fileEnv.TEST_ADMIN_EMAIL || null;
  const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || fileEnv.TEST_ADMIN_PASSWORD || null;

  let DATABASE_URL = process.env.DATABASE_URL || fileEnv.DATABASE_URL || null;

  // Fallback: assemble from component DB variables if available
  if (!DATABASE_URL) {
    const user = process.env.SUPABASE_DB_USER || fileEnv.SUPABASE_DB_USER;
    const password = process.env.SUPABASE_DB_PASSWORD || fileEnv.SUPABASE_DB_PASSWORD;
    const host = process.env.SUPABASE_DB_HOST || fileEnv.SUPABASE_DB_HOST;
    const port = process.env.SUPABASE_DB_PORT || fileEnv.SUPABASE_DB_PORT || '5432';
    if (user && password && host) {
      DATABASE_URL = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
    }
  }

  return {
    DATABASE_URL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD
  };
}

/**
 * Get a single pg.Client instance connected to Supabase
 */
export async function getClient() {
  const { DATABASE_URL } = getEnvConfig();
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined in process environment or .env');
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  return client;
}

/**
 * Execute a callback within an automatically managed client
 */
export async function withClient(callback) {
  const client = await getClient();
  try {
    return await callback(client);
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}

/**
 * Execute a callback within a database transaction.
 * If dryRun is true, the transaction is ALWAYS rolled back.
 */
export async function withTransaction(callback, { dryRun = false } = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
    return { result, dryRun };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    try {
      await client.end();
    } catch (_) {}
  }
}
