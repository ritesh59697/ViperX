import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getConnectionString(): string {
  let conn = process.env.DATABASE_URL || "";
  if (!conn) {
    conn = "postgres://postgres:postgres@localhost:5432/viperx";
  }
  // Supabase pooler on port 5432 is Session Mode (limited to 15 clients).
  // Port 6543 is Transaction Mode (designed for serverless/lambdas, supporting thousands of concurrent queries).
  if (conn.includes(".pooler.supabase.com:5432")) {
    conn = conn.replace(":5432", ":6543");
  }
  return conn;
}

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: getConnectionString(),
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

// Retain pool across warm serverless invocations to avoid repeated TLS handshakes
globalForPg.pgPool = pool;

