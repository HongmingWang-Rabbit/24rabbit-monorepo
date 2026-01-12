import { Queue, Worker, Job } from 'bullmq';
import type { SocialPlatform } from '@24rabbit/shared';
import { getQueueConnection } from './connection';

// Queue Names
export const QUEUE_NAMES = {
  ANALYZE: 'analyze',
  GENERATE: 'generate',
  PUBLISH: 'publish',
  ANALYTICS: 'analytics',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// =============================================================================
// Job Data Types
// =============================================================================

/** Material analysis job - extracts content and generates embeddings */
export interface AnalyzeJobData {
  materialId: string;
  organizationId: string;
}

/** Content generation job - creates social media posts from materials */
export interface GenerateJobData {
  scheduleId?: string;
  materialId: string;
  brandProfileId: string;
  organizationId: string;
  platforms: SocialPlatform[];
  scheduledFor?: string; // ISO date string
  isManual?: boolean;
}

/** Publishing job - posts content to social platforms */
export interface PublishJobData {
  pendingPostId: string;
  brandProfileId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  organizationId: string;
}

/** Analytics collection job - fetches metrics from platforms */
export interface AnalyticsJobData {
  postId: string;
  platformPostId: string;
  platform: SocialPlatform;
  socialAccountId: string;
}

// =============================================================================
// Queue Configuration
// =============================================================================

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days
  },
};

// =============================================================================
// Queue Factory
// =============================================================================

export function createQueue<T>(name: QueueName): Queue<T> {
  return new Queue<T>(name, {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

// =============================================================================
// Worker Factory
// =============================================================================

export interface WorkerOptions {
  concurrency?: number;
}

export function createWorker<T>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<void>,
  options: WorkerOptions = {}
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: getQueueConnection(),
    concurrency: options.concurrency ?? 5,
  });
}

// =============================================================================
// Pre-configured Queue Instances
// =============================================================================

export const analyzeQueue = createQueue<AnalyzeJobData>(QUEUE_NAMES.ANALYZE);
export const generateQueue = createQueue<GenerateJobData>(QUEUE_NAMES.GENERATE);
export const publishQueue = createQueue<PublishJobData>(QUEUE_NAMES.PUBLISH);
export const analyticsQueue = createQueue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS);

// =============================================================================
// Dynamic Queue Getter
// =============================================================================

const queueCache = new Map<string, Queue<unknown>>();

/**
 * Get or create a queue by name
 */
export function getQueue<T>(name: QueueName): Queue<T> {
  if (!queueCache.has(name)) {
    queueCache.set(name, createQueue<T>(name));
  }
  return queueCache.get(name) as Queue<T>;
}

// Re-export Job type for convenience
export type { Job };
