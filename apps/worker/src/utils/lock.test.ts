/**
 * Distributed Lock Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config before importing lock module
vi.mock('../config', () => ({
  config: {
    logLevel: 'error',
    workerId: 'default-test-worker',
    isProd: false,
  },
}));

import { DistributedLock, withLock, LOCK_KEYS, createDistributedLock } from './lock';

// Mock Redis client
function createMockRedis() {
  const store = new Map<string, string>();

  return {
    store,
    set: vi.fn(async (key: string, value: string, mode?: string, ex?: string, ttl?: number) => {
      if (mode === 'NX' && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key) ?? null;
    }),
    del: vi.fn(async (key: string) => {
      const had = store.has(key);
      store.delete(key);
      return had ? 1 : 0;
    }),
    eval: vi.fn(async (script: string, numKeys: number, key: string, ...args: string[]) => {
      // Simulate Lua script behavior
      const currentValue = store.get(key);

      if (script.includes('del')) {
        // Release script
        if (currentValue === args[0]) {
          store.delete(key);
          return 1;
        }
        return 0;
      }

      if (script.includes('expire')) {
        // Extend script
        if (currentValue === args[0]) {
          return 1;
        }
        return 0;
      }

      return 0;
    }),
  };
}

describe('DistributedLock', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let lock: DistributedLock;

  beforeEach(() => {
    mockRedis = createMockRedis();
    lock = new DistributedLock(mockRedis as any, 'test-worker');
  });

  describe('acquire', () => {
    it('should acquire lock when not held', async () => {
      const result = await lock.acquire('test-lock', 60);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('test-lock', 'test-worker', 'NX', 'EX', 60);
    });

    it('should fail to acquire lock when already held', async () => {
      // First acquisition
      await lock.acquire('test-lock', 60);

      // Create another lock instance (simulating another worker)
      const otherLock = new DistributedLock(mockRedis as any, 'other-worker');

      // Second acquisition should fail
      const result = await otherLock.acquire('test-lock', 60);

      expect(result).toBe(false);
    });

    it('should allow same worker to re-acquire own lock', async () => {
      await lock.acquire('test-lock', 60);

      // Clear the store to simulate expired lock
      mockRedis.store.clear();

      const result = await lock.acquire('test-lock', 60);
      expect(result).toBe(true);
    });
  });

  describe('release', () => {
    it('should release lock when owned', async () => {
      await lock.acquire('test-lock', 60);

      const result = await lock.release('test-lock');

      expect(result).toBe(true);
      expect(mockRedis.store.has('test-lock')).toBe(false);
    });

    it('should not release lock owned by another worker', async () => {
      // Set lock as owned by another worker
      mockRedis.store.set('test-lock', 'other-worker');

      const result = await lock.release('test-lock');

      expect(result).toBe(false);
      expect(mockRedis.store.has('test-lock')).toBe(true);
    });

    it('should handle releasing non-existent lock', async () => {
      const result = await lock.release('non-existent-lock');

      expect(result).toBe(false);
    });
  });

  describe('extend', () => {
    it('should extend lock TTL when owned', async () => {
      await lock.acquire('test-lock', 60);

      const result = await lock.extend('test-lock', 120);

      expect(result).toBe(true);
    });

    it('should not extend lock owned by another worker', async () => {
      mockRedis.store.set('test-lock', 'other-worker');

      const result = await lock.extend('test-lock', 120);

      expect(result).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return true when lock is held', async () => {
      await lock.acquire('test-lock', 60);

      const result = await lock.isLocked('test-lock');

      expect(result).toBe(true);
    });

    it('should return false when lock is not held', async () => {
      const result = await lock.isLocked('test-lock');

      expect(result).toBe(false);
    });
  });

  describe('isOwnedByUs', () => {
    it('should return true when we own the lock', async () => {
      await lock.acquire('test-lock', 60);

      const result = await lock.isOwnedByUs('test-lock');

      expect(result).toBe(true);
    });

    it('should return false when someone else owns the lock', async () => {
      mockRedis.store.set('test-lock', 'other-worker');

      const result = await lock.isOwnedByUs('test-lock');

      expect(result).toBe(false);
    });

    it('should return false when lock is not held', async () => {
      const result = await lock.isOwnedByUs('test-lock');

      expect(result).toBe(false);
    });
  });

  describe('getHolder', () => {
    it('should return holder when lock is held', async () => {
      await lock.acquire('test-lock', 60);

      const holder = await lock.getHolder('test-lock');

      expect(holder).toBe('test-worker');
    });

    it('should return null when lock is not held', async () => {
      const holder = await lock.getHolder('test-lock');

      expect(holder).toBeNull();
    });
  });
});

describe('withLock', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let lock: DistributedLock;

  beforeEach(() => {
    mockRedis = createMockRedis();
    lock = new DistributedLock(mockRedis as any, 'test-worker');
  });

  it('should execute function when lock is acquired', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const result = await withLock(lock, 'test-lock', 60, fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should release lock after function completes', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    await withLock(lock, 'test-lock', 60, fn);

    expect(mockRedis.store.has('test-lock')).toBe(false);
  });

  it('should release lock even if function throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withLock(lock, 'test-lock', 60, fn)).rejects.toThrow('fail');

    expect(mockRedis.store.has('test-lock')).toBe(false);
  });

  it('should return null when lock cannot be acquired', async () => {
    // Lock already held by someone else
    mockRedis.store.set('test-lock', 'other-worker');

    const fn = vi.fn().mockResolvedValue('result');
    const result = await withLock(lock, 'test-lock', 60, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('LOCK_KEYS', () => {
  it('should have content scheduler lock key', () => {
    expect(LOCK_KEYS.CONTENT_SCHEDULER).toBe('scheduler:content:lock');
  });

  it('should have analytics scheduler lock key', () => {
    expect(LOCK_KEYS.ANALYTICS_SCHEDULER).toBe('scheduler:analytics:lock');
  });
});

describe('createDistributedLock', () => {
  it('should create a DistributedLock instance', () => {
    const mockRedis = createMockRedis();
    const lock = createDistributedLock({ redis: mockRedis as any });

    expect(lock).toBeInstanceOf(DistributedLock);
  });

  it('should accept custom worker ID', () => {
    const mockRedis = createMockRedis();
    const lock = createDistributedLock({
      redis: mockRedis as any,
      workerId: 'custom-worker',
    });

    expect(lock).toBeInstanceOf(DistributedLock);
  });
});
