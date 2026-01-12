/**
 * Distributed Lock
 *
 * Redis-based distributed lock for preventing duplicate scheduler execution
 * across multiple worker instances.
 */

import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('lock');

// Use 'any' type for Redis to avoid ioredis version mismatch issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = any;

export class DistributedLock {
  constructor(
    private readonly redis: RedisLike,
    private readonly workerId: string = config.workerId
  ) {}

  /**
   * Attempt to acquire a lock
   * @returns true if lock was acquired, false if already held
   */
  async acquire(lockKey: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(lockKey, this.workerId, 'NX', 'EX', ttlSeconds);

    if (result === 'OK') {
      logger.debug('Lock acquired', { lockKey, workerId: this.workerId, ttlSeconds });
      return true;
    }

    return false;
  }

  /**
   * Release a lock (only if we own it)
   */
  async release(lockKey: string): Promise<boolean> {
    // Lua script to atomically check owner and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, this.workerId);

    if (result === 1) {
      logger.debug('Lock released', { lockKey, workerId: this.workerId });
      return true;
    }

    return false;
  }

  /**
   * Extend the lock TTL (only if we own it)
   */
  async extend(lockKey: string, ttlSeconds: number): Promise<boolean> {
    // Lua script to atomically check owner and extend
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, this.workerId, ttlSeconds);

    if (result === 1) {
      logger.debug('Lock extended', { lockKey, workerId: this.workerId, ttlSeconds });
      return true;
    }

    return false;
  }

  /**
   * Check if lock is held (by anyone)
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const value = await this.redis.get(lockKey);
    return value !== null;
  }

  /**
   * Check if we own the lock
   */
  async isOwnedByUs(lockKey: string): Promise<boolean> {
    const value = await this.redis.get(lockKey);
    return value === this.workerId;
  }

  /**
   * Get the current lock holder (if any)
   */
  async getHolder(lockKey: string): Promise<string | null> {
    return this.redis.get(lockKey);
  }
}

/**
 * Execute a function with a distributed lock
 * Automatically acquires and releases the lock
 */
export async function withLock<T>(
  lock: DistributedLock,
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await lock.acquire(lockKey, ttlSeconds);

  if (!acquired) {
    logger.debug('Could not acquire lock, skipping', { lockKey });
    return null;
  }

  try {
    return await fn();
  } finally {
    await lock.release(lockKey);
  }
}

// Lock keys for schedulers
export const LOCK_KEYS = {
  CONTENT_SCHEDULER: 'scheduler:content:lock',
  ANALYTICS_SCHEDULER: 'scheduler:analytics:lock',
} as const;

// =============================================================================
// Factory Function
// =============================================================================

export interface DistributedLockDeps {
  redis: RedisLike;
  workerId?: string;
}

/**
 * Create a distributed lock instance
 */
export function createDistributedLock(deps: DistributedLockDeps): DistributedLock {
  return new DistributedLock(deps.redis, deps.workerId);
}
