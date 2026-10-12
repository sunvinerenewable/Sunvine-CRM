/**
 * Sunvine Renewable Energy - Client Environment Configuration
 * Centralized, validated environment configuration for the client application.
 * All client-side environment variables must be prefixed with VITE_.
 * Never expose server-side secrets (SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, etc.) here.
 */

const getEnvVar = (key, fallback = '') => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return fallback;
};

export const ENV = Object.freeze({
  // Supabase Client Config (Anon key is public for catalog reading)
  SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL', 'https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY', 'placeholder-anon-key'),

  // External APIs
  GEOAPIFY_API_KEY: getEnvVar('VITE_GEOAPIFY_API_KEY', ''),
  GOOGLE_PLACES_API_KEY: getEnvVar('VITE_GOOGLE_PLACES_API_KEY', ''),

  // Application Telemetry & Environment
  APP_ENV: getEnvVar('MODE', getEnvVar('NODE_ENV', 'development')),
  IS_PRODUCTION: getEnvVar('PROD', false) || getEnvVar('NODE_ENV') === 'production',
  IS_DEVELOPMENT: getEnvVar('DEV', true) || getEnvVar('NODE_ENV') === 'development',
  IS_TEST: getEnvVar('MODE') === 'test' || getEnvVar('NODE_ENV') === 'test',

  // Base URL
  BASE_URL: getEnvVar('VITE_BASE_URL', typeof window !== 'undefined' ? window.location.origin : '')
});

export const isConfigured = {
  supabase: Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_URL !== 'https://placeholder.supabase.co' && ENV.SUPABASE_ANON_KEY && ENV.SUPABASE_ANON_KEY !== 'placeholder-anon-key'),
  maps: Boolean(ENV.GEOAPIFY_API_KEY || ENV.GOOGLE_PLACES_API_KEY)
};

export default ENV;
