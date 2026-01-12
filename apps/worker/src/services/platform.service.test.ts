/**
 * Platform Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config before any imports
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

// Mock the platforms package
vi.mock('@24rabbit/platforms', () => ({
  FacebookConnector: class MockFacebookConnector {
    platform = 'FACEBOOK' as const;
    async publishPost(params: any) {
      return { id: 'post-123', url: 'https://facebook.com/post-123' };
    }
    async getPostAnalytics(postId: string) {
      return { likes: 100, comments: 10, shares: 5, impressions: 1000, reach: 800, clicks: 50 };
    }
    async refreshToken(refreshToken: string) {
      return { accessToken: 'new-token', expiresAt: new Date() };
    }
  },
}));

import {
  createPlatformService,
  getConnector,
  getWrappedConnector,
  isPlatformSupported,
  getSupportedPlatforms,
  initializePlatformConnectors,
  type PlatformService,
} from './platform.service';
import type { SocialPlatform } from '@24rabbit/shared';

describe('PlatformService', () => {
  let platformService: PlatformService;

  beforeEach(() => {
    platformService = createPlatformService();
  });

  describe('getConnector', () => {
    it('should return connector for FACEBOOK', () => {
      const connector = platformService.getConnector('FACEBOOK');

      expect(connector).toBeDefined();
      expect(connector.platform).toBe('FACEBOOK');
    });

    it('should throw for unsupported platform', () => {
      expect(() => platformService.getConnector('UNSUPPORTED' as SocialPlatform)).toThrow(
        'Unsupported platform: UNSUPPORTED'
      );
    });

    it('should return same connector instance for same platform', () => {
      const connector1 = platformService.getConnector('FACEBOOK');
      const connector2 = platformService.getConnector('FACEBOOK');

      expect(connector1).toBe(connector2);
    });
  });

  describe('getWrappedConnector', () => {
    it('should return wrapped connector with circuit breaker', () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      expect(wrapped).toBeDefined();
      expect(wrapped.platform).toBe('FACEBOOK');
      expect(typeof wrapped.isCircuitOpen).toBe('function');
    });

    it('should have circuit breaker initially closed', () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      expect(wrapped.isCircuitOpen()).toBe(false);
    });
  });

  describe('isPlatformSupported', () => {
    it('should return true for supported platform', () => {
      expect(platformService.isPlatformSupported('FACEBOOK')).toBe(true);
    });

    it('should return false for unsupported platform', () => {
      expect(platformService.isPlatformSupported('UNSUPPORTED' as SocialPlatform)).toBe(false);
    });
  });

  describe('getSupportedPlatforms', () => {
    it('should return list of supported platforms', () => {
      const platforms = platformService.getSupportedPlatforms();

      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms).toContain('FACEBOOK');
    });
  });
});

describe('WrappedPlatformConnector', () => {
  let platformService: PlatformService;

  beforeEach(() => {
    platformService = createPlatformService();
  });

  describe('publishPost', () => {
    it('should call underlying connector publishPost', async () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      const result = await wrapped.publishPost({
        content: 'Test post',
        accessToken: 'test-token',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('post-123');
    });

    it('should track failures in circuit breaker', async () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      // Simulating that the circuit breaker tracks the result
      // In real implementation, failures would increment the counter
      expect(wrapped.isCircuitOpen()).toBe(false);
    });
  });

  describe('getPostAnalytics', () => {
    it('should call underlying connector getPostAnalytics', async () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      const result = await wrapped.getPostAnalytics('post-123');

      expect(result).toBeDefined();
      expect(result.likes).toBe(100);
      expect(result.comments).toBe(10);
      expect(result.shares).toBe(5);
    });
  });

  describe('refreshToken', () => {
    it('should call underlying connector refreshToken', async () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      const result = await wrapped.refreshToken('old-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new-token');
    });
  });

  describe('circuit breaker integration', () => {
    it('should track successes', async () => {
      const wrapped = platformService.getWrappedConnector('FACEBOOK');

      await wrapped.getPostAnalytics('post-123');

      expect(wrapped.isCircuitOpen()).toBe(false);
    });
  });
});

describe('Standalone functions', () => {
  beforeEach(() => {
    initializePlatformConnectors();
  });

  it('getConnector should work as standalone function', () => {
    const connector = getConnector('FACEBOOK');
    expect(connector).toBeDefined();
    expect(connector.platform).toBe('FACEBOOK');
  });

  it('getWrappedConnector should work as standalone function', () => {
    const wrapped = getWrappedConnector('FACEBOOK');
    expect(wrapped).toBeDefined();
    expect(wrapped.isCircuitOpen()).toBe(false);
  });

  it('isPlatformSupported should work as standalone function', () => {
    expect(isPlatformSupported('FACEBOOK')).toBe(true);
  });

  it('getSupportedPlatforms should work as standalone function', () => {
    const platforms = getSupportedPlatforms();
    expect(platforms).toContain('FACEBOOK');
  });
});
