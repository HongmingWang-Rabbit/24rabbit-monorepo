import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Try to load environment variables from .env.local first, then .env
const envFiles = ['.env.local', '.env'];
let envLoaded = false;

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath });
    console.log(`[vitest] Loaded environment from ${envFile}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('[vitest] No .env file found, using fallback test values');
}

// Only set fallback values if not already set (allows real env vars to take precedence)
const setFallback = (key: string, value: string) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
};

// Fallback values for CI or when .env files are not available
setFallback('DATABASE_URL', 'postgresql://test:test@localhost:5433/test_db');
setFallback('REDIS_URL', 'redis://localhost:6379');
setFallback('ENCRYPTION_KEY', '0'.repeat(64)); // 32 bytes hex
setFallback('GEMINI_API_KEY', 'test-api-key');
setFallback('R2_ACCESS_KEY_ID', 'test-access-key');
setFallback('R2_SECRET_ACCESS_KEY', 'test-secret-key');
setFallback('R2_BUCKET_NAME', 'test-bucket');
setFallback('R2_ENDPOINT', 'http://localhost:9000');
setFallback('R2_PUBLIC_URL', 'http://localhost:9000/test-bucket');
setFallback('BETTER_AUTH_SECRET', 'test-secret-for-better-auth-minimum-32-chars');
