/**
 * AI Package Utilities
 * Image processing, retry logic, and error handling
 */

// Custom error types for AI operations
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export type AIErrorCode =
  | 'RATE_LIMIT'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'CONTENT_FILTERED'
  | 'UNKNOWN';

/**
 * Fetch an image from URL and convert to base64
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<{
  data: string;
  mimeType: string;
}> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new AIError(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
        'NETWORK_ERROR',
        response.status >= 500
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      data: base64,
      mimeType: contentType.split(';')[0], // Remove charset if present
    };
  } catch (error) {
    if (error instanceof AIError) throw error;

    throw new AIError(
      `Failed to fetch image from ${imageUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR',
      true,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is not retryable
      if (error instanceof AIError && !error.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      // Wait before retrying
      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse AI error from Gemini API response
 */
export function parseGeminiError(error: unknown): AIError {
  if (error instanceof AIError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const errorStr = message.toLowerCase();

  // Rate limiting
  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return new AIError(
      'Rate limit exceeded',
      'RATE_LIMIT',
      true,
      error instanceof Error ? error : undefined
    );
  }

  // API key issues
  if (
    errorStr.includes('api key') ||
    errorStr.includes('401') ||
    errorStr.includes('unauthorized')
  ) {
    return new AIError(
      'Invalid API key',
      'INVALID_API_KEY',
      false,
      error instanceof Error ? error : undefined
    );
  }

  // Quota exceeded
  if (errorStr.includes('quota') || errorStr.includes('billing')) {
    return new AIError(
      'API quota exceeded',
      'QUOTA_EXCEEDED',
      false,
      error instanceof Error ? error : undefined
    );
  }

  // Content filtered
  if (
    errorStr.includes('safety') ||
    errorStr.includes('blocked') ||
    errorStr.includes('filtered')
  ) {
    return new AIError(
      'Content was filtered by safety settings',
      'CONTENT_FILTERED',
      false,
      error instanceof Error ? error : undefined
    );
  }

  // Invalid input
  if (
    errorStr.includes('invalid') &&
    (errorStr.includes('input') || errorStr.includes('request'))
  ) {
    return new AIError(
      'Invalid input provided',
      'INVALID_INPUT',
      false,
      error instanceof Error ? error : undefined
    );
  }

  // Network errors (retryable)
  if (
    errorStr.includes('network') ||
    errorStr.includes('timeout') ||
    errorStr.includes('econnrefused')
  ) {
    return new AIError(
      'Network error',
      'NETWORK_ERROR',
      true,
      error instanceof Error ? error : undefined
    );
  }

  // Default to unknown
  return new AIError(message, 'UNKNOWN', false, error instanceof Error ? error : undefined);
}

/**
 * Safely parse JSON from AI response, handling markdown code blocks
 */
export function parseAIResponse<T>(text: string): T {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.trim();

    // Handle ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    return JSON.parse(cleaned);
  } catch (error) {
    throw new AIError(
      `Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      'PARSE_ERROR',
      false,
      error instanceof Error ? error : undefined
    );
  }
}
