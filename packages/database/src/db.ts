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
// Default Singleton (for backwards compatibility)
// =============================================================================

// Create postgres connection
const connectionString = process.env.DATABASE_URL!;

// For query purposes (used by drizzle)
const queryClient = postgres(connectionString);

// Create drizzle instance with schema and relations
export const db = drizzle(queryClient, {
  schema: { ...schema, ...relations },
});

// Re-export postgres client for advanced use cases
export { queryClient };
