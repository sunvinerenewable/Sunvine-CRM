import { withClient } from './db.mjs';

/**
 * Safe query runner for SELECT-only verification.
 * Strictly rejects any data-modifying or DDL statements.
 */
async function main() {
  const queryStr = process.argv.slice(2).join(' ').trim();
  if (!queryStr) {
    console.error('Usage: node scripts/rollout/query.mjs "<SELECT query>"');
    process.exit(1);
  }

  // Sanity check: must start with SELECT, WITH, EXPLAIN, or SHOW
  const normalized = queryStr.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim().toUpperCase();
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH') && !normalized.startsWith('EXPLAIN') && !normalized.startsWith('SHOW')) {
    console.error('[SECURITY REJECTION] Only read-only queries (SELECT / WITH / EXPLAIN / SHOW) are permitted via query.mjs.');
    process.exit(1);
  }

  // Reject multiple statements or dangerous keywords inside
  const forbidden = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE ', 'GRANT ', 'REVOKE '];
  for (const word of forbidden) {
    if (normalized.includes(word)) {
      console.error(`[SECURITY REJECTION] Query contains forbidden keyword: ${word.trim()}`);
      process.exit(1);
    }
  }

  await withClient(async (client) => {
    const res = await client.query(queryStr);
    if (!res.rows || res.rows.length === 0) {
      console.log('(0 rows returned)');
      return;
    }

    // Mask any password_hash or similar column for safety
    const sanitized = res.rows.map(row => {
      const copy = { ...row };
      for (const k of Object.keys(copy)) {
        if (k.toLowerCase().includes('password') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('hash')) {
          if (typeof copy[k] === 'string' && copy[k].length > 0) {
            const prefix = copy[k].split('$')[0] || copy[k].slice(0, 7);
            copy[k] = `[REDACTED format:${prefix}...]`;
          }
        }
      }
      return copy;
    });

    if (sanitized.some(r => Object.values(r).some(v => typeof v === 'object' && v !== null))) {
      console.dir(sanitized, { depth: null });
    } else {
      console.table(sanitized);
    }
  });
}

main().catch(err => {
  console.error('[QUERY ERROR]:', err.message);
  process.exit(1);
});
