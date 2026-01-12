import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

// Export database type for use in other packages
export type Database = ReturnType<typeof createDatabase>;

/**
 * Create a database instance with the given connection string
 */
export function createDatabase(connectionString: string) {
  const queryClient = postgres(connectionString);
  return drizzle(queryClient, {
    schema: { ...schema, ...relations },
  });
}

// =============================================================================
// Default Singleton (lazy initialization for build compatibility)
// =============================================================================

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'Please set it in your .env file or environment.'
    );
  }
  return url;
}

// Lazy initialization to avoid errors during Next.js build
let _queryClient: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getQueryClient() {
  if (!_queryClient) {
    const connectionString = getConnectionString();
    _queryClient = postgres(connectionString);
  }
  return _queryClient;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getQueryClient(), {
      schema: { ...schema, ...relations },
    });
  }
  return _db;
}

// Export getters that lazily initialize the connection
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});

export const queryClient = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) {
    return getQueryClient()[prop as keyof ReturnType<typeof postgres>];
  },
});
