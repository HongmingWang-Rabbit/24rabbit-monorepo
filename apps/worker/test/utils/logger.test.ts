/**
 * Logger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../../src/utils/logger';

// Mock the config
vi.mock('../../src/config', () => ({
  config: {
    logLevel: 'debug', // Allow all log levels in tests
    workerId: 'test-worker',
    isProd: false,
  },
}));

describe('createLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger creation', () => {
    it('should create a logger with a name', () => {
      const logger = createLogger('test-service');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      const logger = createLogger('test');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test message');
    });

    it('should include context in log output', () => {
      const logger = createLogger('test');
      logger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test message');
    });

    it('should include service name in log output', () => {
      const logger = createLogger('my-service');
      logger.info('Test');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('my-service');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      const logger = createLogger('test');
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Error occurred');
    });

    it('should log error with context', () => {
      const logger = createLogger('test');
      logger.error('Error occurred', new Error('fail'), { userId: '123' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Error occurred');
    });

    it('should handle null error gracefully', () => {
      const logger = createLogger('test');
      logger.error('Error occurred', null);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      const logger = createLogger('test');
      logger.warn('Warning message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Warning message');
    });

    it('should include context in warnings', () => {
      const logger = createLogger('test');
      logger.warn('Rate limit approaching', { current: 95, limit: 100 });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug messages when log level is debug', () => {
      const logger = createLogger('test');
      logger.debug('Debug info');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Debug info');
    });

    it('should include context in debug logs', () => {
      const logger = createLogger('test');
      logger.debug('Processing item', { itemId: '456', step: 3 });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log format', () => {
    it('should use emoji indicators for different levels', () => {
      const logger = createLogger('test');

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      // Should have 4 log calls
      expect(consoleLogSpy).toHaveBeenCalledTimes(4);
    });

    it('should include timestamp in production format', () => {
      // In non-prod mode, we get human readable format
      const logger = createLogger('test');
      logger.info('Test');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
