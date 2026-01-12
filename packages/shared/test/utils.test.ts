/**
 * Shared Utils Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, generateEncryptionKey, sleep, retry, truncate } from '../src/utils';

describe('encrypt/decrypt', () => {
  const testKey = '0'.repeat(64); // 32 bytes hex (256 bits)

  it('should encrypt and decrypt text correctly', () => {
    const plaintext = 'Hello, World!';
    const encrypted = encrypt(plaintext, testKey);
    const decrypted = decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'Same text';
    const encrypted1 = encrypt(plaintext, testKey);
    const encrypted2 = encrypt(plaintext, testKey);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty string', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext, testKey);
    const decrypted = decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle unicode characters', () => {
    const plaintext = '你好世界 🌍 مرحبا';
    const encrypted = encrypt(plaintext, testKey);
    const decrypted = decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle long text', () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = encrypt(plaintext, testKey);
    const decrypted = decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should fail with wrong key', () => {
    const plaintext = 'Secret message';
    const encrypted = encrypt(plaintext, testKey);
    const wrongKey = '1'.repeat(64);

    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('should fail with tampered ciphertext', () => {
    const plaintext = 'Secret message';
    const encrypted = encrypt(plaintext, testKey);
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${'ff'.repeat(ciphertext.length / 2)}`;

    expect(() => decrypt(tampered, testKey)).toThrow();
  });
});

describe('generateEncryptionKey', () => {
  it('should generate a 64-character hex string (32 bytes)', () => {
    const key = generateEncryptionKey();

    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  it('should generate unique keys', () => {
    const key1 = generateEncryptionKey();
    const key2 = generateEncryptionKey();

    expect(key1).not.toBe(key2);
  });

  it('should generate keys that work with encrypt/decrypt', () => {
    const key = generateEncryptionKey();
    const plaintext = 'Test message';
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified milliseconds', async () => {
    const sleepPromise = sleep(1000);
    let resolved = false;

    sleepPromise.then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    expect(resolved).toBe(false);

    // Advance timers
    await vi.advanceTimersByTimeAsync(1000);

    // Should be resolved now
    await sleepPromise;
    expect(resolved).toBe(true);
  });

  it('should work with 0ms', async () => {
    const sleepPromise = sleep(0);
    await vi.advanceTimersByTimeAsync(0);
    await sleepPromise;
    // If we reach here, the test passes
    expect(true).toBe(true);
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retry(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = retry(fn, { maxRetries: 3, baseDelay: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const resultPromise = retry(fn, { maxRetries: 2, baseDelay: 100 });
    const expectation = expect(resultPromise).rejects.toThrow('always fails');
    await vi.runAllTimersAsync();
    await expectation;

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should use exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    vi.stubGlobal('setTimeout', (cb: () => void, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(cb, 0);
    });

    const resultPromise = retry(fn, { maxRetries: 3, baseDelay: 100 });
    const expectation = expect(resultPromise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await expectation;

    vi.unstubAllGlobals();

    // Delays should be 100, 200, 400 (exponential backoff)
    expect(delays).toEqual([100, 200, 400]);
  });

  it('should use default options', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retry(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
  });
});

describe('truncate', () => {
  it('should return original text if shorter than maxLength', () => {
    const text = 'Hello';
    const result = truncate(text, 10);

    expect(result).toBe('Hello');
  });

  it('should return original text if equal to maxLength', () => {
    const text = 'Hello';
    const result = truncate(text, 5);

    expect(result).toBe('Hello');
  });

  it('should truncate and add ellipsis if longer than maxLength', () => {
    const text = 'Hello, World!';
    const result = truncate(text, 10);

    expect(result).toBe('Hello, ...');
    expect(result).toHaveLength(10);
  });

  it('should handle maxLength of 3 (minimum for ellipsis)', () => {
    const text = 'Hello';
    const result = truncate(text, 3);

    expect(result).toBe('...');
  });

  it('should handle empty string', () => {
    const result = truncate('', 10);

    expect(result).toBe('');
  });
});
