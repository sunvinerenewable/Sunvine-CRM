import { ensureEnvLoaded } from './db.js';

// Ensure environment variables are loaded into process.env before accessing
ensureEnvLoaded();

/**
 * Server-Side Environment Configuration & Validation Module
 * Single point of truth for serverless handlers and backend utilities.
 */

export const SERVER_ENV = {
  // Database & Supabase
  get supabaseUrl() {
    return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  },
  get supabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  },
  get supabaseAnonKey() {
    return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  },
  get databaseUrl() {
    return process.env.DATABASE_URL || '';
  },

  // Auth & Cryptography
  get jwtSecret() {
    return process.env.JWT_SECRET || '';
  },

  // CORS
  get allowedOrigins() {
    const raw = process.env.ALLOWED_ORIGINS || '';
    return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  },

  // Upstash Redis
  get redisRestUrl() {
    return process.env.UPSTASH_REDIS_REST_URL || '';
  },
  get redisRestToken() {
    return process.env.UPSTASH_REDIS_REST_TOKEN || '';
  },

  // Cloudflare R2 Storage
  get r2AccountId() {
    return process.env.CLOUDFLARE_ACCOUNT_ID || '';
  },
  get r2AccessKeyId() {
    return process.env.R2_ACCESS_KEY_ID || '';
  },
  get r2SecretAccessKey() {
    return process.env.R2_SECRET_ACCESS_KEY || '';
  },
  get r2BucketName() {
    return process.env.R2_BUCKET_NAME || 'sunvine-documents';
  },
  get r2PublicDomain() {
    return process.env.R2_PUBLIC_DOMAIN || '';
  },

  // Slack Integration
  get slackBotToken() {
    return process.env.SLACK_BOT_TOKEN || '';
  },
  get slackFilesChannelId() {
    return process.env.SLACK_FILES_CHANNEL_ID || '';
  },
  get slackCrashWebhookUrl() {
    return process.env.SLACK_CRASH_WEBHOOK_URL || '';
  },
  get appBaseUrl() {
    return process.env.APP_BASE_URL || 'https://portal.sunvinesolar.com';
  },

  // Environment mode
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction() {
    return (process.env.NODE_ENV || '').toLowerCase() === 'production' || Boolean(process.env.VERCEL_ENV === 'production');
  }
};

/**
 * Validates critical environment configuration
 * Throws early or logs warnings if mandatory server environment vars are missing.
 */
export function validateServerEnv() {
  const warnings = [];
  if (!SERVER_ENV.supabaseUrl) warnings.push('SUPABASE_URL is not set');
  if (!SERVER_ENV.supabaseServiceKey && !SERVER_ENV.supabaseAnonKey) warnings.push('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (!SERVER_ENV.jwtSecret) warnings.push('JWT_SECRET is not set (required for auth verification)');

  if (warnings.length > 0 && SERVER_ENV.nodeEnv !== 'test') {
    console.warn('[SERVER_ENV WARNING]:', warnings.join('; '));
  }
  return warnings.length === 0;
}

export default SERVER_ENV;
