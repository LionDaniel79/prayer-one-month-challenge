import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../lib/env";

let client: Pool | undefined;

export function getDb() {
  if (!client) {
    // pg URL parameters otherwise override the explicit TLS policy below.
    const connectionUrl = new URL(getEnv().DATABASE_URL);
    for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslnegotiation"]) {
      connectionUrl.searchParams.delete(key);
    }
    client = new Pool({
      connectionString: connectionUrl.toString(),
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 5_000,
      query_timeout: 10_000,
      statement_timeout: 8_000,
      keepAlive: true,
      // Preserve the existing postgres-js ssl: "require" policy.
      ssl: { rejectUnauthorized: false },
    });
    // An idle socket failure must not crash the process or poison the next request.
    client.on("error", () => console.warn("Database idle connection closed"));
    attachDatabasePool(client);
  }

  const pool = client;
  const db = drizzle(pool);
  db.transaction = async (transaction, config) => {
    const connection = await pool.connect();
    let failed = true;
    try {
      // Own acquisition/release: Drizzle starts BEGIN before its cleanup block.
      const result = await drizzle(connection).transaction(transaction, config);
      failed = false;
      return result;
    } finally {
      // Discard uncertain transaction state, including failed BEGIN/ROLLBACK.
      connection.release(failed);
    }
  };
  return db;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = undefined;
  }
}
