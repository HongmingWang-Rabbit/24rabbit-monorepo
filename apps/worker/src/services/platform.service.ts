/**
 * Platform Service
 *
 * Registry and factory for platform connectors.
 * Provides unified interface to access different social platform APIs.
 */

import type { SocialPlatform } from '@24rabbit/shared';
import type { PlatformConnector } from '@24rabbit/platforms';
import { FacebookConnector } from '@24rabbit/platforms';
import { createLogger } from '../utils/logger';
import { getPlatformCircuitBreaker } from '../utils/circuit-breaker';

const logger = createLogger('platform-service');

// =============================================================================
// Platform Connector Registry
// =============================================================================

const connectors: Map<SocialPlatform, PlatformConnector> = new Map();

/**
 * Initialize and register a platform connector
 */
function registerConnector(platform: SocialPlatform, connector: PlatformConnector): void {
  connectors.set(platform, connector);
  logger.info('Platform connector registered', { platform });
}

/**
 * Get a platform connector
 * @throws Error if platform is not supported
 */
export function getConnector(platform: SocialPlatform): PlatformConnector {
  const connector = connectors.get(platform);

  if (!connector) {
    throw new Error(`Unsupported platform: ${platform}. No connector registered.`);
  }

  return connector;
}

/**
 * Check if a platform is supported
 */
export function isPlatformSupported(platform: SocialPlatform): boolean {
  return connectors.has(platform);
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): SocialPlatform[] {
  return Array.from(connectors.keys());
}

// =============================================================================
// Wrapped Connector with Circuit Breaker
// =============================================================================

export interface WrappedPlatformConnector extends PlatformConnector {
  isCircuitOpen(): boolean;
}

/**
 * Get a platform connector wrapped with circuit breaker
 */
export function getWrappedConnector(platform: SocialPlatform): WrappedPlatformConnector {
  const connector = getConnector(platform);
  const circuitBreaker = getPlatformCircuitBreaker(platform);

  return {
    platform: connector.platform,

    async publishPost(params) {
      return circuitBreaker.execute(() => connector.publishPost(params));
    },

    async getPostAnalytics(postId) {
      return circuitBreaker.execute(() => connector.getPostAnalytics(postId));
    },

    async refreshToken(refreshToken) {
      return circuitBreaker.execute(() => connector.refreshToken(refreshToken));
    },

    isCircuitOpen() {
      return circuitBreaker.isOpen();
    },
  };
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize all platform connectors
 * Call this during worker startup
 */
export function initializePlatformConnectors(): void {
  // Register Facebook connector
  registerConnector('FACEBOOK', new FacebookConnector());

  // TODO: Add more connectors as they're implemented
  // registerConnector('TWITTER', new TwitterConnector());
  // registerConnector('LINKEDIN', new LinkedInConnector());
  // registerConnector('INSTAGRAM', new InstagramConnector());

  logger.info('Platform connectors initialized', {
    supported: getSupportedPlatforms(),
  });
}

// =============================================================================
// Platform Service Interface
// =============================================================================

export interface PlatformService {
  getConnector(platform: SocialPlatform): PlatformConnector;
  getWrappedConnector(platform: SocialPlatform): WrappedPlatformConnector;
  isPlatformSupported(platform: SocialPlatform): boolean;
  getSupportedPlatforms(): SocialPlatform[];
}

/**
 * Create a platform service instance
 */
export function createPlatformService(): PlatformService {
  // Ensure connectors are initialized
  if (connectors.size === 0) {
    initializePlatformConnectors();
  }

  return {
    getConnector,
    getWrappedConnector,
    isPlatformSupported,
    getSupportedPlatforms,
  };
}
