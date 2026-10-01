import fs from 'fs';
import path from 'path';
import { getClient, getEnvConfig } from './db.mjs';
import { verifyPassword } from '../../api/_lib/security.js';
import { createClient } from '@supabase/supabase-js';

// Masking helpers
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[NO_EMAIL]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[INVALID_EMAIL]';
  const [local, domain] = parts;
  const maskedLocal = local.length <= 2 
    ? `${local[0]}*` 
    : `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0];
  const maskedDomain = domainName.length <= 2 
    ? `${domainName[0]}*` 
    : `${domainName[0]}${'*'.repeat(Math.max(1, domainName.length - 2))}${domainName[domainName.length - 1]}`;
  const tld = domainParts.slice(1).join('.');
  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '[NO_PHONE]';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '****';
  const prefix = cleaned.slice(0, 2);
  const suffix = cleaned.slice(-2);
  return `${prefix}${'*'.repeat(Math.max(2, cleaned.length - 4))}${suffix}`;
}

function detectHashFormat(hash) {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    return 'null_or_empty';
  }
  const trimmed = hash.trim();
  if (trimmed.startsWith('$2a$') || trimmed.startsWith('$2b$') || trimmed.startsWith('$2y$') || trimmed.startsWith('$2x$')) {
    return 'bcrypt';
  }
  if (trimmed.startsWith('pbkdf2$')) {
    return 'pbkdf2';
  }
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return 'md5';
  }
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return 'sha256';
  }
  return 'plaintext';
}

async function auditTable(client, tableName, idCol, emailCol, phoneCol, codeCol, roleCol, defaultFirst) {
  console.log(`\nAuditing table: ${tableName}...`);
  
  // 1. Column info
  const colRes = await client.query(
    `SELECT column_name, data_type, is_nullable 
     FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = $1 
     ORDER BY ordinal_position`,
    [tableName]
  );
  const columnNames = colRes.rows.map(r => r.column_name);

  // 2. Fetch rows
  const queryCols = ['id', 'password_hash'];
  if (emailCol && columnNames.includes(emailCol)) queryCols.push(emailCol);
  if (phoneCol && columnNames.includes(phoneCol)) queryCols.push(phoneCol);
  if (codeCol && columnNames.includes(codeCol)) queryCols.push(codeCol);
  if (roleCol && columnNames.includes(roleCol)) queryCols.push(roleCol);
  if (columnNames.includes('status')) queryCols.push('status');
  if (columnNames.includes('created_at')) queryCols.push('created_at');
  if (columnNames.includes('last_login')) queryCols.push('last_login');

  const rowsRes = await client.query(`SELECT ${queryCols.join(', ')} FROM ${tableName} ORDER BY created_at ASC`);
  const rows = rowsRes.rows;

  const formatCounts = {
    bcrypt: 0,
    pbkdf2: 0,
    md5: 0,
    sha256: 0,
    plaintext: 0,
    null_or_empty: 0
  };

  const weakRows = [];
  const safeRows = [];
  const emptyRows = [];

  // Common dictionary
  const baseDictionary = [
    'password', '12345678', '123456', '123456789', '0000', '1234', 'qwerty',
    'sunvine', 'sunvine123', 'Sunvine@123', '1234567890123456'
  ];

  // Memoization cache to avoid redundant bcrypt comparisons for identical hashes
  const hashCache = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hash = row.password_hash;
    const format = detectHashFormat(hash);
    formatCounts[format] = (formatCounts[format] || 0) + 1;

    const email = emailCol ? row[emailCol] : null;
    const phone = phoneCol ? row[phoneCol] : null;
    const code = codeCol ? row[codeCol] : null;
    const maskedId = email ? maskEmail(email) : (phone ? maskPhone(phone) : `ID-${row.id.slice(0, 8)}`);

    if (format === 'null_or_empty') {
      emptyRows.push({
        id: row.id,
        table: tableName,
        maskedId,
        reason: 'empty hash',
        status: row.status || 'unknown'
      });
      continue;
    }

    if (format === 'plaintext') {
      weakRows.push({
        id: row.id,
        table: tableName,
        maskedId,
        reason: 'plaintext password',
        status: row.status || 'unknown'
      });
      continue;
    }

    // Check memoized cache
    if (hashCache.has(hash)) {
      const cached = hashCache.get(hash);
      if (cached.isWeak) {
        weakRows.push({
          id: row.id,
          table: tableName,
          maskedId,
          reason: cached.reason,
          status: row.status || 'unknown'
        });
      } else {
        safeRows.push({
          id: row.id,
          table: tableName,
          maskedId,
          status: row.status || 'unknown'
        });
      }
      continue;
    }

    // Build candidate list with priority
    const candidates = [];
    if (defaultFirst) {
      candidates.push({ candidate: defaultFirst, label: `matches default ${defaultFirst}` });
    }
    // Cross table defaults
    const systemDefaults = ['admin123', 'dealer123', 'staff123', 'verify123'];
    for (const def of systemDefaults) {
      if (def !== defaultFirst) {
        candidates.push({ candidate: def, label: `matches default ${def}` });
      }
    }
    // Dynamic patterns based on account data
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length >= 6) {
        candidates.push({ candidate: cleanPhone, label: 'matches mobile number' });
        if (cleanPhone.length >= 10) {
          candidates.push({ candidate: cleanPhone.slice(-10), label: 'matches 10-digit mobile' });
        }
        if (cleanPhone.length >= 8) {
          candidates.push({ candidate: cleanPhone.slice(-8), label: 'matches last 8 digits of mobile' });
        }
        candidates.push({ candidate: cleanPhone.slice(-6), label: 'matches last 6 digits of mobile' });
      }
    }
    if (code) {
      candidates.push({ candidate: String(code), label: 'matches dealer/access code' });
      candidates.push({ candidate: String(code).toLowerCase(), label: 'matches dealer/access code' });
    }
    // Common dictionary
    for (const dict of baseDictionary) {
      candidates.push({ candidate: dict, label: `matches common dictionary: ${dict}` });
    }

    let matched = null;
    for (const { candidate, label } of candidates) {
      if (verifyPassword(candidate, hash)) {
        matched = label;
        break;
      }
    }

    if (matched) {
      hashCache.set(hash, { isWeak: true, reason: matched });
      weakRows.push({
        id: row.id,
        table: tableName,
        maskedId,
        reason: matched,
        status: row.status || 'unknown'
      });
    } else {
      hashCache.set(hash, { isWeak: false });
      safeRows.push({
        id: row.id,
        table: tableName,
        maskedId,
        status: row.status || 'unknown'
      });
    }

    if ((i + 1) % 50 === 0 || i === rows.length - 1) {
      console.log(`  Processed ${i + 1}/${rows.length} rows...`);
    }
  }

  return {
    tableName,
    columns: columnNames,
    totalRows: rows.length,
    formatCounts,
    safeCount: safeRows.length,
    weakCount: weakRows.length,
    emptyCount: emptyRows.length,
    weakRows,
    emptyRows,
    safeRows
  };
}

async function checkAuthUsers(client, config) {
  const users = [];
  try {
    const res = await client.query(`
      SELECT id, email, created_at, last_sign_in_at 
      FROM auth.users 
      ORDER BY created_at ASC
    `);
    for (const r of res.rows) {
      users.push({
        id: r.id,
        email: r.email,
        maskedEmail: maskEmail(r.email),
        created_at: r.created_at,
        last_sign_in_at: r.last_sign_in_at
      });
    }
  } catch (err) {
    console.log(`Could not query auth.users via pooler (${err.message}). Trying Supabase API...`);
    if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;
        for (const u of data.users) {
          users.push({
            id: u.id,
            email: u.email,
            maskedEmail: maskEmail(u.email),
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at
          });
        }
      } catch (apiErr) {
        console.log(`Could not query auth.users via API: ${apiErr.message}`);
      }
    }
  }
  return users;
}

async function run() {
  console.log('=== Sunvine Production Account Audit (Step 3 Phase B) ===');
  const config = getEnvConfig();
  const client = await getClient();

  const runDir = path.resolve(process.cwd(), 'rollout-run');
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  try {
    // Audit admin_accounts
    const adminReport = await auditTable(
      client,
      'admin_accounts',
      'id',
      'email',
      null,
      null,
      'role',
      'admin123'
    );

    // Audit staff_accounts
    const staffReport = await auditTable(
      client,
      'staff_accounts',
      'id',
      'email',
      'phone',
      'access_code',
      'role',
      'staff123'
    );

    // Audit dealer_accounts
    const dealerReport = await auditTable(
      client,
      'dealer_accounts',
      'id',
      'email',
      'mobile_number',
      'dealer_code',
      null,
      'dealer123'
    );

    // Check auth.users
    const authUsers = await checkAuthUsers(client, config);

    // Generate markdown report
    let md = `# Production Account Security Audit (Phase B)\n\n`;
    md += `Generated: ${new Date().toISOString()}\n`;
    md += `Database: wyberzvcyrjipjqpotwe (Supabase PostgreSQL)\n\n`;

    md += `## 1. Summary of Accounts\n\n`;
    md += `| Table | Total Rows | Safe Passwords | Weak / Backdoor Passwords | Empty / Null Passwords |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    md += `| \`admin_accounts\` | ${adminReport.totalRows} | ${adminReport.safeCount} | ${adminReport.weakCount} | ${adminReport.emptyCount} |\n`;
    md += `| \`staff_accounts\` | ${staffReport.totalRows} | ${staffReport.safeCount} | ${staffReport.weakCount} | ${staffReport.emptyCount} |\n`;
    md += `| \`dealer_accounts\` | ${dealerReport.totalRows} | ${dealerReport.safeCount} | ${dealerReport.weakCount} | ${dealerReport.emptyCount} |\n`;
    md += `| **TOTAL** | **${adminReport.totalRows + staffReport.totalRows + dealerReport.totalRows}** | **${adminReport.safeCount + staffReport.safeCount + dealerReport.safeCount}** | **${adminReport.weakCount + staffReport.weakCount + dealerReport.weakCount}** | **${adminReport.emptyCount + staffReport.emptyCount + dealerReport.emptyCount}** |\n\n`;

    md += `## 2. Hash Schemes Distribution\n\n`;
    const allTables = [adminReport, staffReport, dealerReport];
    for (const t of allTables) {
      md += `### \`${t.tableName}\`\n`;
      md += `Columns: \`${t.columns.join(', ')}\`\n\n`;
      md += `| Format | Count |\n| :--- | :--- |\n`;
      for (const [fmt, cnt] of Object.entries(t.formatCounts)) {
        md += `| ${fmt} | ${cnt} |\n`;
      }
      md += `\n`;
    }

    md += `## 3. Flagged Weak / Backdoor Accounts\n\n`;
    const allFlagged = [
      ...adminReport.weakRows, ...adminReport.emptyRows,
      ...staffReport.weakRows, ...staffReport.emptyRows,
      ...dealerReport.weakRows, ...dealerReport.emptyRows
    ];

    if (allFlagged.length === 0) {
      md += `*No weak or empty password accounts found across all tables.*\n\n`;
    } else {
      md += `| Table | ID | Masked Identifier | Status | Pattern Matched |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const f of allFlagged) {
        md += `| \`${f.table}\` | \`${f.id}\` | \`${f.maskedId}\` | ${f.status} | ${f.reason} |\n`;
      }
      md += `\n`;
    }

    md += `## 4. Supabase auth.users\n\n`;
    if (authUsers.length === 0) {
      md += `*No users found in auth.users or table is empty.*\n\n`;
    } else {
      md += `Total users in \`auth.users\`: ${authUsers.length}\n\n`;
      md += `| ID | Masked Email | Created At | Last Sign In |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      for (const u of authUsers) {
        md += `| \`${u.id}\` | \`${u.maskedEmail}\` | ${u.created_at || 'Never'} | ${u.last_sign_in_at || 'Never'} |\n`;
      }
      md += `\n`;
    }

    const reportPath = path.resolve(runDir, '03a-weak-accounts.md');
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\nAudit completed successfully! Saved to: ${reportPath}`);

    // Print summary counts to terminal
    console.log('\n--- AUDIT SUMMARY ---');
    console.log(`Weak admin accounts: ${adminReport.weakCount}`);
    console.log(`Weak staff accounts: ${staffReport.weakCount}`);
    console.log(`Weak dealer accounts: ${dealerReport.weakCount}`);
    console.log(`Empty password accounts: ${adminReport.emptyCount + staffReport.emptyCount + dealerReport.emptyCount}`);

  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
