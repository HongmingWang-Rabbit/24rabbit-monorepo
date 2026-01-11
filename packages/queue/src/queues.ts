import { Queue, Worker, Job } from 'bullmq';
import { getQueueConnection } from './connection';

// Queue Names
export const QUEUE_NAMES = {
  PUBLISH: 'publish',
  SCHEDULE: 'schedule',
  ANALYTICS: 'analytics',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Job Types
export interface PublishJobData {
  postId: string;
  brandProfileId: string;
  socialAccountId: string;
  content: string;
  mediaUrls?: string[];
}

export interface ScheduleJobData {
  scheduleId: string;
  brandProfileId: string;
}

export interface AnalyticsJobData {
  postId: string;
  platformPostId: string;
  platform: string;
}

// Queue Factory
export function createQueue<T>(name: QueueName): Queue<T> {
  return new Queue<T>(name, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // 7 days
      },
    },
  });
}

// Worker Factory
export function createWorker<T>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<void>
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection: getQueueConnection(),
    concurrency: 5,
  });
}

// Pre-configured queues
export const publishQueue = createQueue<PublishJobData>(QUEUE_NAMES.PUBLISH);
export const scheduleQueue = createQueue<ScheduleJobData>(QUEUE_NAMES.SCHEDULE);
export const analyticsQueue = createQueue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS);
