/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';

// Mock the config
vi.mock('../config', () => ({
  config: {
    circuitBreaker: {
      threshold: 5,
      resetTimeoutMs: 60000,
    },
    logLevel: 'error',
    workerId: 'test-worker',
    isProd: false,
  },
}));

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    // Create with explicit settings to override config defaults
    circuitBreaker = new CircuitBreaker('test-service', 3, 10000, 2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should not be open initially', () => {
      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('closed state', () => {
    it('should allow requests in closed state', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should track failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // First failure
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
      expect(circuitBreaker.getState()).toBe('closed');

      // Second failure
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should open after reaching failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Three failures to trigger open (threshold is 3)
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('fail');

      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should reset failure count on success', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Two failures
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');

      // Success resets counter
      await circuitBreaker.execute(successFn);

      // Two more failures should not open circuit (need 3 consecutive)
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');

      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('open state', () => {
    beforeEach(async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }
    });

    it('should reject requests immediately when open', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(fn)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to half-open after timeout when execute is called', async () => {
      // Advance time past reset timeout
      vi.advanceTimersByTime(10001);

      // Call execute to trigger transition check
      const fn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(fn);

      expect(circuitBreaker.getState()).toBe('half-open');
    });
  });

  describe('half-open state', () => {
    beforeEach(async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      // Advance time to allow transition to half-open
      vi.advanceTimersByTime(10001);

      // Trigger transition to half-open
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
    });

    it('should allow requests in half-open state', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(fn);
      expect(result).toBe('success');
    });

    it('should close after enough successful requests', async () => {
      // We need halfOpenSuccessThreshold (2) successful requests to close
      // Already had one success in beforeEach, need one more
      const fn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(fn);

      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should reopen on failed request in half-open state', async () => {
      // Reset to open state first
      circuitBreaker.reset();
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }

      // Advance time to allow transition to half-open
      vi.advanceTimersByTime(10001);

      // First execute transitions to half-open and succeeds
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      // Now fail - should reopen
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');

      expect(circuitBreaker.getState()).toBe('open');
    });
  });

  describe('reset', () => {
    it('should reset to closed state', async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe('open');

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return current stats', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();

      const stats = circuitBreaker.getStats();

      expect(stats.name).toBe('test-service');
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(1);
      expect(stats.threshold).toBe(3);
    });
  });
});
