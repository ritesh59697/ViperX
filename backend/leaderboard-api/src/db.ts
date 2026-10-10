import * as dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see .env / README)`);
  return value;
}

export const DATABASE_URL = requireEnv("DATABASE_URL");
export const PORT = Number(process.env.PORT ?? 4000);

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 4, // Keep within the hosted database connection limit (e.g. pool_size 15 shared across indexer, runner, and API)
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

