/**
 * Error Classification System
 *
 * Provides structured error types and classification for proper retry handling.
 */

export type ErrorCategory =
  | 'network'
  | 'rate_limit'
  | 'auth'
  | 'validation'
  | 'content_policy'
  | 'not_found'
  | 'quota_exceeded'
  | 'service_unavailable'
  | 'unknown';

export interface ErrorClassification {
  retryable: boolean;
  category: ErrorCategory;
  delayMs?: number;
  userMessage?: string;
}

/**
 * Base error class for worker errors with retry information
 */
export class WorkerError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly category: ErrorCategory,
    public readonly originalError?: Error | unknown
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends WorkerError {
  constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message, true, 'rate_limit');
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthError extends WorkerError {
  constructor(message: string, public readonly requiresReauth: boolean = false) {
    super(message, !requiresReauth, 'auth');
    this.name = 'AuthError';
  }
}

/**
 * Error thrown when content violates platform policies
 */
export class ContentPolicyError extends WorkerError {
  constructor(message: string, public readonly platform: string) {
    super(message, false, 'content_policy');
    this.name = 'ContentPolicyError';
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends WorkerError {
  constructor(message: string) {
    super(message, false, 'not_found');
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when user quota is exceeded
 */
export class QuotaExceededError extends WorkerError {
  constructor(message: string) {
    super(message, false, 'quota_exceeded');
    this.name = 'QuotaExceededError';
  }
}

/**
 * Classify an unknown error for retry handling
 */
export function classifyError(error: unknown): ErrorClassification {
  // Already classified
  if (error instanceof WorkerError) {
    return {
      retryable: error.retryable,
      category: error.category,
      delayMs: error instanceof RateLimitError ? error.retryAfterMs : undefined,
    };
  }

  if (!(error instanceof Error)) {
    return { retryable: true, category: 'unknown' };
  }

  const message = error.message.toLowerCase();
  const errorAny = error as { code?: string; status?: number; response?: { status?: number } };

  // Network errors - retryable
  if (
    errorAny.code === 'ETIMEDOUT' ||
    errorAny.code === 'ECONNRESET' ||
    errorAny.code === 'ECONNREFUSED' ||
    errorAny.code === 'ENOTFOUND' ||
    message.includes('timeout') ||
    message.includes('network')
  ) {
    return { retryable: true, category: 'network' };
  }

  // Get HTTP status
  const status = errorAny.status ?? errorAny.response?.status;

  // Rate limiting - retryable with delay
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return {
      retryable: true,
      category: 'rate_limit',
      delayMs: 60000, // Default 1 minute delay
    };
  }

  // Service unavailable - retryable
  if (status === 502 || status === 503 || status === 504) {
    return { retryable: true, category: 'service_unavailable' };
  }

  // Auth errors - may need token refresh
  if (status === 401 || message.includes('unauthorized') || message.includes('invalid token')) {
    return { retryable: true, category: 'auth' };
  }

  // Forbidden - might be content policy
  if (status === 403) {
    if (message.includes('policy') || message.includes('violation')) {
      return {
        retryable: false,
        category: 'content_policy',
        userMessage: 'Content violates platform policies',
      };
    }
    return { retryable: false, category: 'auth' };
  }

  // Not found - not retryable
  if (status === 404) {
    return { retryable: false, category: 'not_found' };
  }

  // Validation errors - not retryable
  if (status === 400 || message.includes('validation') || message.includes('invalid')) {
    return { retryable: false, category: 'validation' };
  }

  // Quota exceeded - not retryable
  if (message.includes('quota') || message.includes('limit exceeded')) {
    return { retryable: false, category: 'quota_exceeded' };
  }

  // Default: unknown, assume retryable
  return { retryable: true, category: 'unknown' };
}

/**
 * User-friendly error messages by category
 */
export const USER_FRIENDLY_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Network error occurred. Please try again.',
  rate_limit: 'Too many requests. Your content will be published when the limit resets.',
  auth: 'Authentication expired. Please reconnect your account.',
  validation: 'Invalid content. Please review and try again.',
  content_policy: 'Content violates platform policies. Please modify and try again.',
  not_found: 'Resource not found. It may have been deleted.',
  quota_exceeded: 'Usage limit reached. Please upgrade your plan or wait for reset.',
  service_unavailable: 'Service temporarily unavailable. Please try again later.',
  unknown: 'An unexpected error occurred. Our team has been notified.',
};

/**
 * Get user-friendly message for an error
 */
export function getUserFriendlyMessage(error: unknown, platform?: string): string {
  const classification = classifyError(error);
  let message = USER_FRIENDLY_MESSAGES[classification.category];

  if (platform) {
    message = message.replace('platform', platform);
  }

  return message;
}
