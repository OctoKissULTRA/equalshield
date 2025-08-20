import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getDatabase() {
  if (!db) {
    const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('POSTGRES_URL or DATABASE_URL environment variable is not set');
    }
    
    client = postgres(databaseUrl);
    db = drizzle(client, { schema });
  }
  return db;
}

export { getDatabase as db };
export { client };
