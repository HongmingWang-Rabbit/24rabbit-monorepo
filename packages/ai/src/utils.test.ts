/**
 * AI Utils Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIError, fetchImageAsBase64, withRetry, parseGeminiError, parseAIResponse } from './utils';

describe('AIError', () => {
  it('should create error with message, code, and retryable flag', () => {
    const error = new AIError('Test error', 'RATE_LIMIT', true);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('AIError');
  });

  it('should default retryable to false', () => {
    const error = new AIError('Non-retryable error', 'INVALID_INPUT');

    expect(error.retryable).toBe(false);
  });

  it('should store cause error', () => {
    const cause = new Error('Original error');
    const error = new AIError('Wrapped error', 'UNKNOWN', false, cause);

    expect(error.cause).toBe(cause);
  });

  it('should be an instance of Error', () => {
    const error = new AIError('Test', 'UNKNOWN');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AIError);
  });

  it('should support all error codes', () => {
    const codes = [
      'RATE_LIMIT',
      'INVALID_API_KEY',
      'QUOTA_EXCEEDED',
      'INVALID_INPUT',
      'NETWORK_ERROR',
      'PARSE_ERROR',
      'CONTENT_FILTERED',
      'UNKNOWN',
    ] as const;

    codes.forEach((code) => {
      const error = new AIError('Test', code);
      expect(error.code).toBe(code);
    });
  });
});

describe('fetchImageAsBase64', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch image and convert to base64', async () => {
    const mockImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(mockImageData.buffer),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await fetchImageAsBase64('https://example.com/image.png');

    expect(result.mimeType).toBe('image/png');
    expect(result.data).toBe(Buffer.from(mockImageData).toString('base64'));
    expect(fetch).toHaveBeenCalledWith('https://example.com/image.png');
  });

  it('should handle content-type with charset', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg; charset=utf-8' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await fetchImageAsBase64('https://example.com/image.jpg');

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should default to image/jpeg if no content-type', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const result = await fetchImageAsBase64('https://example.com/image');

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should throw AIError on HTTP error (4xx)', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(fetchImageAsBase64('https://example.com/missing.png')).rejects.toThrow(AIError);
    await expect(fetchImageAsBase64('https://example.com/missing.png')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: false,
    });
  });

  it('should mark 5xx errors as retryable', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    };

    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    await expect(fetchImageAsBase64('https://example.com/image.png')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('should throw AIError on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(fetchImageAsBase64('https://example.com/image.png')).rejects.toThrow(AIError);
    await expect(fetchImageAsBase64('https://example.com/image.png')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const resultPromise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry non-retryable AIError', async () => {
    const fn = vi.fn().mockRejectedValue(new AIError('Not retryable', 'INVALID_INPUT', false));

    const resultPromise = withRetry(fn, { maxRetries: 3 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow('Not retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry retryable AIError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIError('Rate limited', 'RATE_LIMIT', true))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxRetries: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.stubGlobal('setTimeout', (cb: () => void, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(cb, 0);
    });

    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    });

    await vi.runAllTimersAsync();
    await expect(resultPromise).rejects.toThrow();

    vi.unstubAllGlobals();

    // Delays should be 100, 200, 400 (exponential)
    expect(delays).toEqual([100, 200, 400]);
  });

  it('should cap delay at maxDelayMs', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.stubGlobal('setTimeout', (cb: () => void, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(cb, 0);
    });

    const resultPromise = withRetry(fn, {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 2000,
      backoffMultiplier: 2,
    });

    await vi.runAllTimersAsync();
    await expect(resultPromise).rejects.toThrow();

    vi.unstubAllGlobals();

    // Should cap at 2000: 1000, 2000, 2000, 2000, 2000
    expect(delays).toEqual([1000, 2000, 2000, 2000, 2000]);
  });
});

describe('parseGeminiError', () => {
  it('should return AIError unchanged', () => {
    const original = new AIError('Test', 'RATE_LIMIT', true);
    const result = parseGeminiError(original);

    expect(result).toBe(original);
  });

  it('should detect rate limit errors', () => {
    const error = new Error('Rate limit exceeded for model');
    const result = parseGeminiError(error);

    expect(result.code).toBe('RATE_LIMIT');
    expect(result.retryable).toBe(true);
  });

  it('should detect 429 status code', () => {
    const error = new Error('Error 429: Too many requests');
    const result = parseGeminiError(error);

    expect(result.code).toBe('RATE_LIMIT');
    expect(result.retryable).toBe(true);
  });

  it('should detect API key errors', () => {
    const error = new Error('API key is invalid');
    const result = parseGeminiError(error);

    expect(result.code).toBe('INVALID_API_KEY');
    expect(result.retryable).toBe(false);
  });

  it('should detect 401 unauthorized', () => {
    const error = new Error('Error 401 unauthorized');
    const result = parseGeminiError(error);

    expect(result.code).toBe('INVALID_API_KEY');
    expect(result.retryable).toBe(false);
  });

  it('should detect quota exceeded', () => {
    const error = new Error('Quota exceeded for the project');
    const result = parseGeminiError(error);

    expect(result.code).toBe('QUOTA_EXCEEDED');
    expect(result.retryable).toBe(false);
  });

  it('should detect billing errors', () => {
    const error = new Error('Billing account issue');
    const result = parseGeminiError(error);

    expect(result.code).toBe('QUOTA_EXCEEDED');
    expect(result.retryable).toBe(false);
  });

  it('should detect content safety errors', () => {
    const error = new Error('Content blocked by safety settings');
    const result = parseGeminiError(error);

    expect(result.code).toBe('CONTENT_FILTERED');
    expect(result.retryable).toBe(false);
  });

  it('should detect filtered content', () => {
    const error = new Error('Response was filtered');
    const result = parseGeminiError(error);

    expect(result.code).toBe('CONTENT_FILTERED');
    expect(result.retryable).toBe(false);
  });

  it('should detect invalid input', () => {
    const error = new Error('Invalid request format');
    const result = parseGeminiError(error);

    expect(result.code).toBe('INVALID_INPUT');
    expect(result.retryable).toBe(false);
  });

  it('should detect network errors', () => {
    const error = new Error('Network connection failed');
    const result = parseGeminiError(error);

    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should detect timeout errors', () => {
    const error = new Error('Request timeout');
    const result = parseGeminiError(error);

    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should detect ECONNREFUSED', () => {
    const error = new Error('ECONNREFUSED');
    const result = parseGeminiError(error);

    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('should default to UNKNOWN for unrecognized errors', () => {
    const error = new Error('Something weird happened');
    const result = parseGeminiError(error);

    expect(result.code).toBe('UNKNOWN');
    expect(result.retryable).toBe(false);
  });

  it('should handle non-Error objects', () => {
    const result = parseGeminiError('string error');

    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('string error');
  });
});

describe('parseAIResponse', () => {
  it('should parse valid JSON', () => {
    const json = '{"key": "value", "number": 42}';
    const result = parseAIResponse<{ key: string; number: number }>(json);

    expect(result).toEqual({ key: 'value', number: 42 });
  });

  it('should handle JSON with whitespace', () => {
    const json = '  \n  {"key": "value"}  \n  ';
    const result = parseAIResponse<{ key: string }>(json);

    expect(result).toEqual({ key: 'value' });
  });

  it('should strip markdown code blocks with json tag', () => {
    const json = '```json\n{"key": "value"}\n```';
    const result = parseAIResponse<{ key: string }>(json);

    expect(result).toEqual({ key: 'value' });
  });

  it('should strip markdown code blocks without tag', () => {
    const json = '```\n{"key": "value"}\n```';
    const result = parseAIResponse<{ key: string }>(json);

    expect(result).toEqual({ key: 'value' });
  });

  it('should handle code blocks with extra whitespace', () => {
    const json = '```json  \n  {"key": "value"}  \n  ```';
    const result = parseAIResponse<{ key: string }>(json);

    expect(result).toEqual({ key: 'value' });
  });

  it('should throw AIError on invalid JSON', () => {
    const invalid = 'not valid json';

    expect(() => parseAIResponse(invalid)).toThrow(AIError);
    expect(() => parseAIResponse(invalid)).toThrow(/Failed to parse AI response/);
  });

  it('should include PARSE_ERROR code on invalid JSON', () => {
    try {
      parseAIResponse('invalid');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIError);
      expect((error as AIError).code).toBe('PARSE_ERROR');
      expect((error as AIError).retryable).toBe(false);
    }
  });

  it('should handle complex nested objects', () => {
    const json = `{
      "variations": [
        {"content": "Hello", "hashtags": ["test"]},
        {"content": "World", "hashtags": ["demo"]}
      ],
      "metadata": {
        "generated": true,
        "count": 2
      }
    }`;

    const result = parseAIResponse<{
      variations: { content: string; hashtags: string[] }[];
      metadata: { generated: boolean; count: number };
    }>(json);

    expect(result.variations).toHaveLength(2);
    expect(result.metadata.generated).toBe(true);
  });
});
