import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Get database URL - throw a descriptive error if not set
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please create a .env.local file with your Neon database URL. ' +
      'See .env.example for a template.'
    );
  }
  return url;
};

// Lazy initialization to prevent build-time errors
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (!_db) {
    const sql = neon(getDatabaseUrl());
    _db = drizzle(sql, { schema });
  }
  return _db;
};

// For backward compatibility - use getDb() for safer initialization
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof typeof _db];
  },
});

export type Database = ReturnType<typeof getDb>;
