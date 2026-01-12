import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local from root
config({ path: resolve(__dirname, '../../.env.local') });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
