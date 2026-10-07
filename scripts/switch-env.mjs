import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const targetEnv = process.argv[2]?.toLowerCase();

const envPath = path.join(rootDir, '.env');
const stagingEnvPath = path.join(rootDir, '.env.staging');
const prodEnvPath = path.join(rootDir, '.env.production');

function getProjectRef(content) {
  const match = content.match(/SUPABASE_PROJECT_ID=(.*)/) || content.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1].trim() : 'Unknown';
}

function showStatus() {
  if (!fs.existsSync(envPath)) {
    console.log('❌ No active .env file found.');
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const ref = getProjectRef(content);
  const isStaging = ref === 'voyargkmlkrlidyxjcbk';
  const isProd = ref === 'wyberzvcyrjipjqpotwe';
  
  console.log('\n=== CURRENT ACTIVE LOCAL ENVIRONMENT STATUS ===');
  console.log(`Active Project Ref: ${ref}`);
  if (isStaging) {
    console.log('Environment       : 🟡 STAGING (sunvine-dealer-staging)');
  } else if (isProd) {
    console.log('Environment       : 🟢 PRODUCTION (Sunvine Production)');
  } else {
    console.log('Environment       : ⚪ CUSTOM / UNKNOWN');
  }
  console.log('===============================================\n');
}

function switchTo(mode) {
  if (mode === 'staging') {
    if (!fs.existsSync(stagingEnvPath)) {
      if (fs.existsSync(envPath)) {
        fs.copyFileSync(envPath, stagingEnvPath);
      } else {
        console.error('❌ .env.staging not found.');
        return;
      }
    }
    fs.copyFileSync(stagingEnvPath, envPath);
    console.log('\n✅ [ENV SWITCHER] Switched active local environment to: 🟡 STAGING (voyargkmlkrlidyxjcbk)');
    showStatus();
  } else if (mode === 'prod' || mode === 'production') {
    if (!fs.existsSync(prodEnvPath)) {
      console.error('❌ .env.production file not found. Creating from template...');
      const stagingContent = fs.existsSync(stagingEnvPath) ? fs.readFileSync(stagingEnvPath, 'utf8') : fs.readFileSync(envPath, 'utf8');
      const prodContent = stagingContent
        .replace(/voyargkmlkrlidyxjcbk/g, 'wyberzvcyrjipjqpotwe')
        .replace(/NODE_ENV=staging/g, 'NODE_ENV=production');
      fs.writeFileSync(prodEnvPath, prodContent, 'utf8');
      console.log('✅ Created .env.production template.');
    }
    fs.copyFileSync(prodEnvPath, envPath);
    console.log('\n✅ [ENV SWITCHER] Switched active local environment to: 🟢 PRODUCTION (wyberzvcyrjipjqpotwe)');
    showStatus();
  } else {
    showStatus();
    console.log('Usage:');
    console.log('  npm run env:staging   -> Switch to Staging Database (voyargkmlkrlidyxjcbk)');
    console.log('  npm run env:prod      -> Switch to Production Database (wyberzvcyrjipjqpotwe)');
    console.log('  npm run env:status    -> View currently active environment');
  }
}

if (!targetEnv || targetEnv === 'status') {
  showStatus();
} else {
  switchTo(targetEnv);
}
