/**
 * Database Module Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock postgres and drizzle before importing the module
vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: vi.fn(),
  })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('Database Module', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('createDatabase', () => {
    it('should create a database instance with connection string', async () => {
      const { createDatabase } = await import('../src/db');
      const postgres = (await import('postgres')).default;
      const { drizzle } = await import('drizzle-orm/postgres-js');

      const db = createDatabase('postgresql://test:test@localhost:5432/testdb');

      expect(postgres).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/testdb');
      expect(drizzle).toHaveBeenCalled();
      expect(db).toBeDefined();
    });
  });

  describe('getConnectionString', () => {
    it('should throw error when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      vi.resetModules();

      const { db } = await import('../src/db');

      // Accessing db.select should trigger lazy initialization
      expect(() => db.select).toThrow('DATABASE_URL environment variable is not set');
    });

    it('should return DATABASE_URL when set', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      vi.resetModules();

      const { db } = await import('../src/db');
      const postgres = (await import('postgres')).default;

      // Access a property to trigger lazy initialization
      const _ = db.select;

      expect(postgres).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/testdb');
    });
  });

  describe('lazy initialization', () => {
    it('should not connect to database on import', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      vi.resetModules();

      const postgres = (await import('postgres')).default;
      vi.mocked(postgres).mockClear();

      // Import but don't access any properties
      await import('../src/db');

      // postgres should not have been called yet
      expect(postgres).not.toHaveBeenCalled();
    });

    it('should connect only when db is accessed', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      vi.resetModules();

      const postgres = (await import('postgres')).default;
      vi.mocked(postgres).mockClear();

      const { db } = await import('../src/db');

      // Access a property to trigger lazy initialization
      const _ = db.select;

      expect(postgres).toHaveBeenCalledTimes(1);
    });

    it('should reuse connection on subsequent accesses', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      vi.resetModules();

      const postgres = (await import('postgres')).default;
      vi.mocked(postgres).mockClear();

      const { db } = await import('../src/db');

      // Access properties multiple times
      const _1 = db.select;
      const _2 = db.insert;
      const _3 = db.update;

      // Should only create one connection
      expect(postgres).toHaveBeenCalledTimes(1);
    });
  });

  describe('queryClient proxy', () => {
    it('should lazily initialize queryClient', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      vi.resetModules();

      const postgres = (await import('postgres')).default;
      vi.mocked(postgres).mockClear();
      vi.mocked(postgres).mockReturnValue({
        end: vi.fn(),
        testProp: 'testValue',
      } as unknown as ReturnType<typeof postgres>);

      const { queryClient } = await import('../src/db');

      // Access a property
      const _ = queryClient.end;

      expect(postgres).toHaveBeenCalledTimes(1);
    });
  });
});
