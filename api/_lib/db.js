import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

let pool = null;

export function ensureEnvLoaded() {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return;
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;
        const rawKey = trimmed.slice(0, eqIdx).trim();
        const key = rawKey.replace(/\s+/g, '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch (_) {}
  }

  // Fallback: assemble DATABASE_URL from components if not directly defined
  if (!process.env.DATABASE_URL) {
    const user = process.env.SUPABASE_DB_USER;
    const password = process.env.SUPABASE_DB_PASSWORD;
    const host = process.env.SUPABASE_DB_HOST;
    const port = process.env.SUPABASE_DB_PORT || '5432';
    if (user && password && host) {
      process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
    }
  }

  // JWT_SECRET is intentionally NOT set here.
  // api/_lib/jwt.js enforces its presence at call-time and throws if missing.
}

// Automatically ensure env is loaded upon import
ensureEnvLoaded();

export function getDbPool() {
  ensureEnvLoaded();
  if (!pool && process.env.DATABASE_URL) {
    const ssl = process.env.PG_CA
      ? { ca: process.env.PG_CA, rejectUnauthorized: true }
      : { rejectUnauthorized: false };

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
      max: 3,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const p = getDbPool();
  if (p) {
    return await p.query(sql, params);
  }
  throw new Error('Database pool not available.');
}

export function getSupabaseServiceClient() {
  ensureEnvLoaded();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('[FATAL] SUPABASE_URL env var is required for the service client.');
  if (!serviceKey) throw new Error('[FATAL] SUPABASE_SERVICE_ROLE_KEY env var is required. Never fall back to the anon key for server-side operations.');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
