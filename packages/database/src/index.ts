// Database connection
export { db, queryClient, createDatabase } from './db';
export type { Database } from './db';

// Schema tables and types
export * from './schema';

// Relations
export * from './relations';

// JSON field types
export * from './types';

// Re-export drizzle utilities for convenience
export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  not,
  isNull,
  isNotNull,
  sql,
  asc,
  desc,
} from 'drizzle-orm';
