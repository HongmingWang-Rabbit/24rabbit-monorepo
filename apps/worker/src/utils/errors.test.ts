/**
 * Error Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  WorkerError,
  RateLimitError,
  AuthError,
  ContentPolicyError,
  NotFoundError,
  QuotaExceededError,
  classifyError,
  getUserFriendlyMessage,
  USER_FRIENDLY_MESSAGES,
} from './errors';

describe('WorkerError', () => {
  it('should create error with message and retryable flag', () => {
    const error = new WorkerError('Test error', true, 'validation');

    expect(error.message).toBe('Test error');
    expect(error.retryable).toBe(true);
    expect(error.category).toBe('validation');
    expect(error.name).toBe('WorkerError');
  });

  it('should default retryable to false', () => {
    const error = new WorkerError('Non-retryable error', false, 'unknown');

    expect(error.retryable).toBe(false);
  });

  it('should be an instance of Error', () => {
    const error = new WorkerError('Test', true, 'unknown');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('RateLimitError', () => {
  it('should create error with retry delay', () => {
    const error = new RateLimitError('Rate limit exceeded', 60000);

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.retryAfterMs).toBe(60000);
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('RateLimitError');
  });

  it('should be retryable by default', () => {
    const error = new RateLimitError('Rate limited', 30000);

    expect(error.retryable).toBe(true);
  });
});

describe('AuthError', () => {
  it('should create auth error', () => {
    const error = new AuthError('Token expired', true);

    expect(error.message).toBe('Token expired');
    expect(error.requiresReauth).toBe(true);
    // When requiresReauth=true, retryable=false
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('AuthError');
  });

  it('should be retryable when requiresReauth is false', () => {
    // When requiresReauth=false, the error IS retryable (can retry with token refresh)
    const error = new AuthError('Invalid token', false);

    expect(error.retryable).toBe(true);
  });

  it('should not be retryable when requiresReauth is true', () => {
    // When requiresReauth=true, the error is NOT retryable (user must re-authenticate)
    const error = new AuthError('Token revoked', true);

    expect(error.retryable).toBe(false);
  });
});

describe('ContentPolicyError', () => {
  it('should create content policy error with platform', () => {
    const error = new ContentPolicyError('Content violates policy', 'FACEBOOK');

    expect(error.message).toBe('Content violates policy');
    expect(error.platform).toBe('FACEBOOK');
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('ContentPolicyError');
  });
});

describe('classifyError', () => {
  it('should classify WorkerError correctly', () => {
    const error = new WorkerError('Test', true, 'validation');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('validation');
  });

  it('should classify RateLimitError correctly', () => {
    const error = new RateLimitError('Rate limited', 60000);
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('rate_limit');
    expect(result.delayMs).toBe(60000);
  });

  it('should classify AuthError correctly', () => {
    const error = new AuthError('Token expired', true);
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('auth');
  });

  it('should classify ContentPolicyError correctly', () => {
    const error = new ContentPolicyError('Policy violation', 'FACEBOOK');
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('content_policy');
  });

  it('should classify network errors by code as retryable', () => {
    const error = new Error('Connection refused') as Error & { code: string };
    error.code = 'ECONNREFUSED';
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('network');
  });

  it('should classify timeout errors as network (retryable)', () => {
    const error = new Error('Request timeout');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    // Timeout errors fall under 'network' category
    expect(result.category).toBe('network');
  });

  it('should classify error with 429 status as rate limit', () => {
    const error = new Error('Too many requests') as Error & { status: number };
    error.status = 429;
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('rate_limit');
  });

  it('should classify error with 503 status as service unavailable', () => {
    const error = new Error('Service unavailable') as Error & { status: number };
    error.status = 503;
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('service_unavailable');
  });

  it('should classify error with 400 status as validation (not retryable)', () => {
    const error = new Error('Bad request') as Error & { status: number };
    error.status = 400;
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('validation');
  });

  it('should classify unknown errors as retryable by default', () => {
    const error = new Error('Unknown error');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('unknown');
  });

  it('should classify rate limit message as rate limit', () => {
    const error = new Error('rate limit exceeded');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('rate_limit');
  });

  it('should classify 401 as auth error', () => {
    const error = new Error('Unauthorized') as Error & { status: number };
    error.status = 401;
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('auth');
  });

  it('should classify 404 as not found', () => {
    const error = new Error('Not found') as Error & { status: number };
    error.status = 404;
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('not_found');
  });

  it('should classify non-Error objects as unknown retryable', () => {
    const result = classifyError('string error');

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('unknown');
  });

  it('should classify ETIMEDOUT as network error', () => {
    const error = new Error('Connection timed out') as Error & { code: string };
    error.code = 'ETIMEDOUT';
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('network');
  });

  it('should classify ECONNRESET as network error', () => {
    const error = new Error('Connection reset') as Error & { code: string };
    error.code = 'ECONNRESET';
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('network');
  });

  it('should classify ENOTFOUND as network error', () => {
    const error = new Error('DNS resolution failed') as Error & { code: string };
    error.code = 'ENOTFOUND';
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('network');
  });

  it('should classify network message as network error', () => {
    const error = new Error('network error occurred');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('network');
  });

  it('should classify too many requests message as rate limit', () => {
    const error = new Error('too many requests');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('rate_limit');
    expect(result.delayMs).toBe(60000);
  });

  it('should classify 502 status as service unavailable', () => {
    const error = new Error('Bad gateway') as Error & { status: number };
    error.status = 502;
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('service_unavailable');
  });

  it('should classify 504 status as service unavailable', () => {
    // Note: Using a message without 'timeout' since that would be classified as network first
    const error = new Error('Gateway unavailable') as Error & { status: number };
    error.status = 504;
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('service_unavailable');
  });

  it('should classify unauthorized message as auth error', () => {
    const error = new Error('unauthorized access');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('auth');
  });

  it('should classify invalid token message as auth error', () => {
    const error = new Error('invalid token provided');
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('auth');
  });

  it('should classify 403 with policy message as content_policy', () => {
    const error = new Error('policy violation detected') as Error & { status: number };
    error.status = 403;
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('content_policy');
    expect(result.userMessage).toBe('Content violates platform policies');
  });

  it('should classify 403 without policy message as auth error', () => {
    const error = new Error('Forbidden') as Error & { status: number };
    error.status = 403;
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('auth');
  });

  it('should classify validation message as validation error', () => {
    const error = new Error('validation failed');
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('validation');
  });

  it('should classify invalid message as validation error', () => {
    const error = new Error('invalid input');
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('validation');
  });

  it('should classify quota message as quota_exceeded', () => {
    const error = new Error('quota exceeded');
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('quota_exceeded');
  });

  it('should classify limit exceeded message as quota_exceeded', () => {
    const error = new Error('limit exceeded for this account');
    const result = classifyError(error);

    expect(result.retryable).toBe(false);
    expect(result.category).toBe('quota_exceeded');
  });

  it('should use response.status when status is not available', () => {
    const error = new Error('Server error') as Error & { response?: { status: number } };
    error.response = { status: 503 };
    const result = classifyError(error);

    expect(result.retryable).toBe(true);
    expect(result.category).toBe('service_unavailable');
  });
});

describe('NotFoundError', () => {
  it('should create not found error', () => {
    const error = new NotFoundError('Resource not found');

    expect(error.message).toBe('Resource not found');
    expect(error.retryable).toBe(false);
    expect(error.category).toBe('not_found');
    expect(error.name).toBe('NotFoundError');
  });
});

describe('QuotaExceededError', () => {
  it('should create quota exceeded error', () => {
    const error = new QuotaExceededError('Usage limit reached');

    expect(error.message).toBe('Usage limit reached');
    expect(error.retryable).toBe(false);
    expect(error.category).toBe('quota_exceeded');
    expect(error.name).toBe('QuotaExceededError');
  });
});

describe('getUserFriendlyMessage', () => {
  it('should return user-friendly message for error', () => {
    const error = new Error('network error');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.network);
  });

  it('should replace platform placeholder with actual platform', () => {
    const error = new ContentPolicyError('Content violates policy', 'FACEBOOK');
    const message = getUserFriendlyMessage(error, 'Facebook');

    expect(message).toBe('Content violates Facebook policies. Please modify and try again.');
  });

  it('should return rate limit message for rate limit error', () => {
    const error = new RateLimitError('Rate limited', 60000);
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.rate_limit);
  });

  it('should return auth message for auth error', () => {
    const error = new AuthError('Token expired', true);
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.auth);
  });

  it('should return validation message for validation error', () => {
    const error = new Error('validation failed');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.validation);
  });

  it('should return not found message for not found error', () => {
    const error = new NotFoundError('Item not found');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.not_found);
  });

  it('should return quota exceeded message for quota error', () => {
    const error = new QuotaExceededError('Limit reached');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.quota_exceeded);
  });

  it('should return service unavailable message for 503 error', () => {
    const error = new Error('Service down') as Error & { status: number };
    error.status = 503;
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.service_unavailable);
  });

  it('should return unknown message for unknown error', () => {
    const error = new Error('Some random error');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe(USER_FRIENDLY_MESSAGES.unknown);
  });
});
