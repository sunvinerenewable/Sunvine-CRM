import fs from 'fs';

async function fetchStagingKeysAndConfigure() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || '';
  const projectRef = 'voyargkmlkrlidyxjcbk';

  console.log(`Connecting to Supabase Management API for staging project ${projectRef}...`);

  try {
    // 1. Get Project Details
    const projRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!projRes.ok) {
      throw new Error(`Failed to fetch project details: ${projRes.status} ${projRes.statusText}`);
    }
    const projData = await projRes.json();
    console.log('✅ Staging project details retrieved. Region:', projData.region);

    // 2. Get API Keys
    const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!keysRes.ok) {
      throw new Error(`Failed to fetch API keys: ${keysRes.status} ${keysRes.statusText}`);
    }
    const keysData = await keysRes.json();
    console.log('✅ Staging API keys retrieved successfully.');

    const anonKeyObj = keysData.find(k => k.name === 'anon' || k.tags === 'anon');
    const serviceRoleKeyObj = keysData.find(k => k.name === 'service_role' || k.tags === 'service_role');

    const anonKey = anonKeyObj?.api_key;
    const serviceRoleKey = serviceRoleKeyObj?.api_key;

    if (!anonKey || !serviceRoleKey) {
      throw new Error('Could not find anon or service_role key in response.');
    }

    // 3. Read current .env.staging
    const currentEnv = fs.readFileSync('.env.staging', 'utf8');
    const lines = currentEnv.split(/\r?\n/);
    const newLines = [];

    const region = projData.region || 'ap-northeast-1';
    const poolerHost = `aws-0-${region}.pooler.supabase.com`;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) {
        newLines.push(line);
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();

      if (key === 'SUPABASE_PROJECT_ID') {
        newLines.push(`SUPABASE_PROJECT_ID=${projectRef}`);
      } else if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        newLines.push(`${key}=https://${projectRef}.supabase.co`);
      } else if (key === 'VITE_SUPABASE_ANON_KEY' || key === 'SUPABASE_ANON_KEY') {
        newLines.push(`${key}=${anonKey}`);
      } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        newLines.push(`${key}=${serviceRoleKey}`);
      } else if (key === 'SUPABASE_DB_HOST') {
        newLines.push(`SUPABASE_DB_HOST=${poolerHost}`);
      } else if (key === 'SUPABASE_DB_PORT') {
        newLines.push(`SUPABASE_DB_PORT=6543`);
      } else if (key === 'SUPABASE_DB_USER') {
        newLines.push(`SUPABASE_DB_USER=postgres.${projectRef}`);
      } else if (key === 'DATABASE_URL') {
        const passMatch = line.match(/:([^:@]+)@/);
        const pass = passMatch ? passMatch[1] : 'Sunvine@1251';
        newLines.push(`DATABASE_URL=postgresql://postgres.${projectRef}:${pass}@${poolerHost}:6543/postgres`);
      } else {
        newLines.push(line);
      }
    }

    if (!newLines.some(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))) {
      newLines.push(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
    }

    const stagingEnvContent = newLines.join('\n');
    fs.writeFileSync('.env.staging', stagingEnvContent, 'utf8');

    console.log('\n🎉 .env.staging CONFIGURED SUCCESSFULLY FOR STAGING!');
  } catch (err) {
    console.error('Error configuring staging env:', err.message);
  }
}

fetchStagingKeysAndConfigure();
