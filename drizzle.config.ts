import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local for local development
config({ path: '.env.local' });
// Fallback to .env
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
