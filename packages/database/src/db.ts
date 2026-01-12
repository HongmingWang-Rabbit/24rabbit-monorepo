import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

// Create postgres connection
const connectionString = process.env.DATABASE_URL!;

// For query purposes (used by drizzle)
const queryClient = postgres(connectionString);

// Create drizzle instance with schema and relations
export const db = drizzle(queryClient, {
  schema: { ...schema, ...relations },
});

// Export database type for use in other packages
export type Database = typeof db;

// Re-export postgres client for advanced use cases
export { queryClient };
