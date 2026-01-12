/**
 * Worker Configuration
 *
 * Centralizes all environment variables and configuration for the worker.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
}

export const config = {
  // Environment
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDev: optionalEnv('NODE_ENV', 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Worker identity
  workerId: optionalEnv('WORKER_ID', `worker-${process.pid}`),

  // Redis
  redisUrl: requireEnv('REDIS_URL'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // AI Provider
  aiProvider: optionalEnv('AI_PROVIDER', 'gemini') as 'gemini' | 'openai' | 'anthropic',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',

  // Storage (MinIO/R2)
  storageUrl: optionalEnv('STORAGE_URL', 'http://localhost:9000'),

  // Encryption key for sensitive data
  encryptionKey: requireEnv('ENCRYPTION_KEY'),

  // Worker concurrency settings
  concurrency: {
    analyze: optionalEnvInt('WORKER_CONCURRENCY_ANALYZE', 3),
    generate: optionalEnvInt('WORKER_CONCURRENCY_GENERATE', 3),
    publish: optionalEnvInt('WORKER_CONCURRENCY_PUBLISH', 5),
    analytics: optionalEnvInt('WORKER_CONCURRENCY_ANALYTICS', 10),
  },

  // Scheduler intervals (ms)
  schedulerIntervals: {
    content: optionalEnvInt('SCHEDULER_CONTENT_INTERVAL_MS', 5 * 60 * 1000), // 5 minutes
    analytics: optionalEnvInt('SCHEDULER_ANALYTICS_INTERVAL_MS', 60 * 60 * 1000), // 1 hour
  },

  // Rate limiting
  rateLimit: {
    defaultPostsPerDay: optionalEnvInt('RATE_LIMIT_POSTS_PER_DAY', 50),
    defaultPostsPerHour: optionalEnvInt('RATE_LIMIT_POSTS_PER_HOUR', 25),
  },

  // Circuit breaker
  circuitBreaker: {
    threshold: optionalEnvInt('CIRCUIT_BREAKER_THRESHOLD', 5),
    resetTimeoutMs: optionalEnvInt('CIRCUIT_BREAKER_RESET_MS', 60000),
  },

  // Similarity threshold for deduplication
  similarityThreshold: parseFloat(optionalEnv('SIMILARITY_THRESHOLD', '0.85')),

  // Content generation
  contentGeneration: {
    variationsCount: optionalEnvInt('CONTENT_VARIATIONS_COUNT', 3),
  },

  // Analytics collection
  analytics: {
    lookbackDays: optionalEnvInt('ANALYTICS_LOOKBACK_DAYS', 7),
    batchSize: optionalEnvInt('ANALYTICS_BATCH_SIZE', 100),
    minUpdateIntervalMs: optionalEnvInt('ANALYTICS_MIN_UPDATE_INTERVAL_MS', 30 * 60 * 1000), // 30 minutes
    postPublishDelayMs: optionalEnvInt('ANALYTICS_POST_PUBLISH_DELAY_MS', 5 * 60 * 1000), // 5 minutes
  },

  // Distributed locking (TTL in seconds)
  lock: {
    contentSchedulerTtl: optionalEnvInt('LOCK_CONTENT_SCHEDULER_TTL', 300), // 5 minutes
    analyticsSchedulerTtl: optionalEnvInt('LOCK_ANALYTICS_SCHEDULER_TTL', 600), // 10 minutes
  },

  // Graceful shutdown
  shutdownTimeoutMs: optionalEnvInt('SHUTDOWN_TIMEOUT_MS', 30000),

  // Logging
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
} as const;

export type Config = typeof config;
