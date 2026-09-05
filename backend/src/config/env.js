import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..', '..');
export const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value, fallback = []) =>
  value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : fallback;

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

/**
 * Secrets must be supplied in production. In development a stable dev-only
 * fallback keeps `npm run dev` working with no configuration at all, but the
 * process refuses to start in production without real values.
 */
function requiredSecret(name, devFallback) {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  if (isProd) {
    throw new Error(
      `${name} is required in production and must be at least 16 characters. ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  return devFallback;
}

export const env = {
  NODE_ENV,
  isProd,
  isTest: NODE_ENV === 'test',
  PORT: int(process.env.PORT, 5000),

  MONGODB_URI: process.env.MONGODB_URI || '',
  // When no MONGODB_URI is configured the server starts an embedded MongoDB so
  // the project runs with a single command. Data is persisted to disk so
  // progress survives a restart.
  USE_MEMORY_DB: bool(process.env.USE_MEMORY_DB, !process.env.MONGODB_URI),
  MEMORY_DB_PATH: process.env.MEMORY_DB_PATH || path.join(REPO_ROOT, '.data', 'mongodb'),

  JWT_ACCESS_SECRET: requiredSecret('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me-please'),
  JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me-please'),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '30m',
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL || '30d',
  REFRESH_COOKIE_NAME: process.env.REFRESH_COOKIE_NAME || 'mlpp_refresh',

  CORS_ORIGINS: list(process.env.CORS_ORIGINS, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
  ]),
  TRUST_PROXY: bool(process.env.TRUST_PROXY, isProd),

  // Optional AI grading. Absent key => deterministic rubric engine only.
  AI_PROVIDER: (process.env.AI_PROVIDER || 'none').toLowerCase(),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  AI_TIMEOUT_MS: int(process.env.AI_TIMEOUT_MS, 30000),

  RATE_LIMIT_WINDOW_MS: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX: int(process.env.RATE_LIMIT_MAX, 1000),
  AUTH_RATE_LIMIT_MAX: int(process.env.AUTH_RATE_LIMIT_MAX, 25),

  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || '',
  LOG_LEVEL: process.env.LOG_LEVEL || (isProd ? 'combined' : 'dev'),
};

export function aiEnabled() {
  return env.AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY);
}
