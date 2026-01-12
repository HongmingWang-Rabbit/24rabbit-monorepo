/**
 * 24Rabbit Worker
 *
 * Background job processor for:
 * - Material analysis (AI extraction and embedding generation)
 * - Content generation (AI-powered copy with Brand Profile context)
 * - Publishing (platform API integration with rate limiting)
 * - Analytics collection (engagement metrics)
 */

import { Worker, type Job } from 'bullmq';
import {
  getQueueConnection,
  closeQueueConnection,
  getQueue,
  QUEUE_NAMES,
  type AnalyzeJobData,
  type GenerateJobData,
  type PublishJobData,
  type AnalyticsJobData,
} from '@24rabbit/queue';
import { createDatabase } from '@24rabbit/database';
import { createAIAdapter } from '@24rabbit/ai';

import { config } from './config';
import { createLogger } from './utils/logger';
import { createDistributedLock } from './utils/lock';

// Services
import {
  createPlatformService,
  createRateLimiterService,
  createSimilarityService,
  createMaterialService,
} from './services';

// Processors
import {
  createMaterialAnalysisProcessor,
  createContentGenerationProcessor,
  createPublishProcessor,
  createAnalyticsProcessor,
} from './processors';

// Schedulers
import { createContentScheduler, createAnalyticsScheduler } from './schedulers';

// =============================================================================
// Main Entry Point
// =============================================================================

const logger = createLogger('worker');

async function main() {
  logger.info('24Rabbit Worker starting...', {
    nodeEnv: config.nodeEnv,
    redisUrl: config.redisUrl.replace(/\/\/.*@/, '//<redacted>@'),
  });

  // ==========================================================================
  // Initialize Core Dependencies
  // ==========================================================================

  // Database
  const db = createDatabase(config.databaseUrl);
  logger.info('Database connection initialized');

  // BullMQ/Redis connection (shared for workers, rate limiting, and locks)
  const queueConnection = getQueueConnection();
  logger.info('Redis connection initialized');

  // AI Adapter
  const aiAdapter = createAIAdapter({
    provider: config.aiProvider,
    apiKey: config.geminiApiKey,
  });
  logger.info('AI adapter initialized', { provider: config.aiProvider });

  // ==========================================================================
  // Initialize Services
  // ==========================================================================

  const platformService = createPlatformService();
  logger.info('Platform service initialized');

  const rateLimiter = createRateLimiterService({ redis: queueConnection });
  logger.info('Rate limiter service initialized');

  const similarityService = createSimilarityService({
    db,
    aiAdapter,
    similarityThreshold: config.similarityThreshold,
  });
  logger.info('Similarity service initialized');

  const materialService = createMaterialService({
    aiAdapter,
    storageUrl: config.storageUrl,
  });
  logger.info('Material service initialized');

  // Distributed lock for schedulers
  const lock = createDistributedLock({ redis: queueConnection });

  // ==========================================================================
  // Initialize Queues
  // ==========================================================================

  const analyzeQueue = getQueue<AnalyzeJobData>(QUEUE_NAMES.ANALYZE);
  const generateQueue = getQueue<GenerateJobData>(QUEUE_NAMES.GENERATE);
  const publishQueue = getQueue<PublishJobData>(QUEUE_NAMES.PUBLISH);
  const analyticsQueue = getQueue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS);

  // ==========================================================================
  // Create Processors
  // ==========================================================================

  const materialAnalysisProcessor = createMaterialAnalysisProcessor({
    db,
    materialService,
    similarityService,
    logger: createLogger('material-analysis'),
  });

  const contentGenerationProcessor = createContentGenerationProcessor({
    db,
    aiAdapter,
    similarityService,
    logger: createLogger('content-generation'),
  });

  const publishProcessor = createPublishProcessor({
    db,
    platformService,
    rateLimiter,
    similarityService,
    analyticsQueue,
    logger: createLogger('publish'),
    encryptionKey: config.encryptionKey,
  });

  const analyticsProcessor = createAnalyticsProcessor({
    db,
    platformService,
    logger: createLogger('analytics'),
    encryptionKey: config.encryptionKey,
  });

  // ==========================================================================
  // Create Workers
  // ==========================================================================

  const workers: Worker[] = [];

  // Worker connection options (use type assertion for ioredis compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerConnection = queueConnection as any;

  // Material Analysis Worker
  const analyzeWorker = new Worker<AnalyzeJobData>(
    QUEUE_NAMES.ANALYZE,
    materialAnalysisProcessor,
    {
      connection: workerConnection,
      concurrency: config.concurrency.analyze,
    }
  );
  workers.push(analyzeWorker);
  logger.info('Analyze worker created', { concurrency: config.concurrency.analyze });

  // Content Generation Worker
  const generateWorker = new Worker<GenerateJobData>(
    QUEUE_NAMES.GENERATE,
    contentGenerationProcessor,
    {
      connection: workerConnection,
      concurrency: config.concurrency.generate,
    }
  );
  workers.push(generateWorker);
  logger.info('Generate worker created', { concurrency: config.concurrency.generate });

  // Publish Worker
  const publishWorker = new Worker<PublishJobData>(
    QUEUE_NAMES.PUBLISH,
    publishProcessor,
    {
      connection: workerConnection,
      concurrency: config.concurrency.publish,
    }
  );
  workers.push(publishWorker);
  logger.info('Publish worker created', { concurrency: config.concurrency.publish });

  // Analytics Worker
  const analyticsWorker = new Worker<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS,
    analyticsProcessor,
    {
      connection: workerConnection,
      concurrency: config.concurrency.analytics,
    }
  );
  workers.push(analyticsWorker);
  logger.info('Analytics worker created', { concurrency: config.concurrency.analytics });

  // ==========================================================================
  // Set Up Worker Event Handlers
  // ==========================================================================

  for (const worker of workers) {
    worker.on('completed', (job: Job) => {
      logger.debug('Job completed', {
        queue: worker.name,
        jobId: job.id,
        jobName: job.name,
      });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error('Job failed', error, {
        queue: worker.name,
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
      });
    });

    worker.on('error', (error: Error) => {
      logger.error('Worker error', error, {
        queue: worker.name,
      });
    });
  }

  // ==========================================================================
  // Create and Start Schedulers
  // ==========================================================================

  const contentScheduler = createContentScheduler({
    db,
    generateQueue,
    lock,
    logger: createLogger('content-scheduler'),
  });

  const analyticsScheduler = createAnalyticsScheduler({
    db,
    analyticsQueue,
    lock,
    logger: createLogger('analytics-scheduler'),
  });

  // Start schedulers
  contentScheduler.start(config.schedulerIntervals.content);
  analyticsScheduler.start(config.schedulerIntervals.analytics);

  logger.info('Schedulers started', {
    contentInterval: config.schedulerIntervals.content,
    analyticsInterval: config.schedulerIntervals.analytics,
  });

  // ==========================================================================
  // Graceful Shutdown
  // ==========================================================================

  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop schedulers first
      contentScheduler.stop();
      analyticsScheduler.stop();
      logger.info('Schedulers stopped');

      // Pause workers to stop accepting new jobs
      await Promise.all(workers.map((w) => w.pause()));
      logger.info('Workers paused');

      // Close workers (wait for current jobs to finish)
      await Promise.all(workers.map((w) => w.close()));
      logger.info('Workers closed');

      // Close connections
      await closeQueueConnection();
      logger.info('Connections closed');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ==========================================================================
  // Ready
  // ==========================================================================

  logger.info('24Rabbit Worker initialized and ready to process jobs', {
    workers: workers.map((w) => w.name),
    queues: Object.values(QUEUE_NAMES),
  });
}

// =============================================================================
// Run
// =============================================================================

main().catch((error) => {
  logger.error('Worker failed to start', error);
  process.exit(1);
});
