/**
 * Vitest Setup File
 *
 * Configures global test environment and mocks.
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock console methods to reduce test output noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

// Restore console.error and console.warn for debugging
// vi.spyOn(console, 'error').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
