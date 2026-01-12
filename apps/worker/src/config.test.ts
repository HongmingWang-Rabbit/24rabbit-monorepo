/**
 * Worker Configuration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Worker Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Set required env vars
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('required environment variables', () => {
    it('should load config with required env vars set', async () => {
      const { config } = await import('./config');

      expect(config.redisUrl).toBe('redis://localhost:6379');
      expect(config.databaseUrl).toBe('postgresql://test:test@localhost:5432/test');
      expect(config.encryptionKey).toBe('0'.repeat(64));
    });

    it('should throw error when REDIS_URL is missing', async () => {
      delete process.env.REDIS_URL;
      vi.resetModules();

      await expect(import('./config')).rejects.toThrow(
        'Missing required environment variable: REDIS_URL'
      );
    });

    it('should throw error when DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      vi.resetModules();

      await expect(import('./config')).rejects.toThrow(
        'Missing required environment variable: DATABASE_URL'
      );
    });

    it('should throw error when ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;
      vi.resetModules();

      await expect(import('./config')).rejects.toThrow(
        'Missing required environment variable: ENCRYPTION_KEY'
      );
    });
  });

  describe('optional environment variables', () => {
    it('should use default values for optional vars', async () => {
      // Note: NODE_ENV may be set by vitest, so we only check truly optional vars
      const { config } = await import('./config');

      expect(config.aiProvider).toBe('gemini');
      expect(config.storageUrl).toBe('http://localhost:9000');
      expect(config.logLevel).toBe('info');
    });

    it('should recognize development environment', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.nodeEnv).toBe('development');
      expect(config.isDev).toBe(true);
      expect(config.isProd).toBe(false);
    });

    it('should use provided values for optional vars', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_PROVIDER = 'openai';
      process.env.STORAGE_URL = 'https://storage.example.com';
      process.env.LOG_LEVEL = 'debug';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.nodeEnv).toBe('production');
      expect(config.isProd).toBe(true);
      expect(config.aiProvider).toBe('openai');
      expect(config.storageUrl).toBe('https://storage.example.com');
      expect(config.logLevel).toBe('debug');
    });
  });

  describe('optional integer environment variables', () => {
    it('should use default values for optional int vars', async () => {
      const { config } = await import('./config');

      expect(config.concurrency.analyze).toBe(3);
      expect(config.concurrency.generate).toBe(3);
      expect(config.concurrency.publish).toBe(5);
      expect(config.concurrency.analytics).toBe(10);
    });

    it('should parse valid integer values', async () => {
      process.env.WORKER_CONCURRENCY_ANALYZE = '10';
      process.env.WORKER_CONCURRENCY_GENERATE = '20';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.concurrency.analyze).toBe(10);
      expect(config.concurrency.generate).toBe(20);
    });

    it('should use default when value is invalid (NaN)', async () => {
      process.env.WORKER_CONCURRENCY_ANALYZE = 'not-a-number';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.concurrency.analyze).toBe(3); // default value
    });
  });

  describe('worker identity', () => {
    it('should generate worker ID from process.pid by default', async () => {
      const { config } = await import('./config');

      expect(config.workerId).toMatch(/^worker-\d+$/);
    });

    it('should use provided WORKER_ID', async () => {
      process.env.WORKER_ID = 'custom-worker-123';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.workerId).toBe('custom-worker-123');
    });
  });

  describe('scheduler intervals', () => {
    it('should have default scheduler intervals', async () => {
      const { config } = await import('./config');

      expect(config.schedulerIntervals.content).toBe(5 * 60 * 1000);
      expect(config.schedulerIntervals.analytics).toBe(60 * 60 * 1000);
    });

    it('should use custom scheduler intervals', async () => {
      process.env.SCHEDULER_CONTENT_INTERVAL_MS = '60000';
      process.env.SCHEDULER_ANALYTICS_INTERVAL_MS = '120000';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.schedulerIntervals.content).toBe(60000);
      expect(config.schedulerIntervals.analytics).toBe(120000);
    });
  });

  describe('rate limiting', () => {
    it('should have default rate limits', async () => {
      const { config } = await import('./config');

      expect(config.rateLimit.defaultPostsPerDay).toBe(50);
      expect(config.rateLimit.defaultPostsPerHour).toBe(25);
    });
  });

  describe('circuit breaker', () => {
    it('should have default circuit breaker settings', async () => {
      const { config } = await import('./config');

      expect(config.circuitBreaker.threshold).toBe(5);
      expect(config.circuitBreaker.resetTimeoutMs).toBe(60000);
    });
  });

  describe('similarity threshold', () => {
    it('should have default similarity threshold', async () => {
      const { config } = await import('./config');

      expect(config.similarityThreshold).toBe(0.85);
    });

    it('should use custom similarity threshold', async () => {
      process.env.SIMILARITY_THRESHOLD = '0.90';
      vi.resetModules();

      const { config } = await import('./config');

      expect(config.similarityThreshold).toBe(0.9);
    });
  });

  describe('analytics settings', () => {
    it('should have default analytics settings', async () => {
      const { config } = await import('./config');

      expect(config.analytics.lookbackDays).toBe(7);
      expect(config.analytics.batchSize).toBe(100);
      expect(config.analytics.minUpdateIntervalMs).toBe(30 * 60 * 1000);
      expect(config.analytics.postPublishDelayMs).toBe(5 * 60 * 1000);
    });
  });

  describe('lock settings', () => {
    it('should have default lock TTL settings', async () => {
      const { config } = await import('./config');

      expect(config.lock.contentSchedulerTtl).toBe(300);
      expect(config.lock.analyticsSchedulerTtl).toBe(600);
    });
  });

  describe('shutdown timeout', () => {
    it('should have default shutdown timeout', async () => {
      const { config } = await import('./config');

      expect(config.shutdownTimeoutMs).toBe(30000);
    });
  });
});
