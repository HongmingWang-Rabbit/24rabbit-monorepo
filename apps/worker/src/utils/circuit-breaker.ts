/**
 * Circuit Breaker
 *
 * Prevents cascading failures when external services are down.
 * States: closed (normal) -> open (failing) -> half-open (testing)
 */

import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('circuit-breaker');

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly serviceName: string) {
    super(`Circuit breaker is open for service: ${serviceName}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: CircuitBreakerState = 'closed';
  private successesSinceHalfOpen = 0;

  constructor(
    private readonly name: string,
    private readonly threshold: number = config.circuitBreaker.threshold,
    private readonly resetTimeoutMs: number = config.circuitBreaker.resetTimeoutMs,
    private readonly halfOpenSuccessThreshold: number = 2
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.lastFailure && Date.now() - this.lastFailure.getTime() > this.resetTimeoutMs) {
        this.state = 'half-open';
        this.successesSinceHalfOpen = 0;
        logger.info('Circuit breaker transitioning to half-open', { service: this.name });
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successesSinceHalfOpen++;
      if (this.successesSinceHalfOpen >= this.halfOpenSuccessThreshold) {
        this.state = 'closed';
        this.failures = 0;
        logger.info('Circuit breaker closed after successful half-open', { service: this.name });
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      // Immediately open on failure in half-open state
      this.state = 'open';
      logger.warn('Circuit breaker re-opened from half-open', { service: this.name });
    } else if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened', {
        service: this.name,
        failures: this.failures,
        threshold: this.threshold,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Force reset the circuit breaker (for testing/admin)
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = null;
    this.successesSinceHalfOpen = 0;
    logger.info('Circuit breaker manually reset', { service: this.name });
  }

  /**
   * Get circuit breaker stats
   */
  getStats(): {
    name: string;
    state: CircuitBreakerState;
    failures: number;
    threshold: number;
    lastFailure: Date | null;
  } {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      lastFailure: this.lastFailure,
    };
  }
}

// =============================================================================
// Pre-configured Circuit Breakers
// =============================================================================

/** Circuit breaker for AI provider (Gemini, etc.) */
export const aiCircuitBreaker = new CircuitBreaker('ai-provider');

/** Circuit breakers for social platforms */
export const platformCircuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a platform
 */
export function getPlatformCircuitBreaker(platform: string): CircuitBreaker {
  let breaker = platformCircuitBreakers.get(platform);
  if (!breaker) {
    breaker = new CircuitBreaker(`platform-${platform}`);
    platformCircuitBreakers.set(platform, breaker);
  }
  return breaker;
}

/**
 * Get stats for all circuit breakers
 */
export function getAllCircuitBreakerStats(): ReturnType<CircuitBreaker['getStats']>[] {
  const stats = [aiCircuitBreaker.getStats()];
  for (const breaker of platformCircuitBreakers.values()) {
    stats.push(breaker.getStats());
  }
  return stats;
}
