import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../src/db/client";
import { classifyDatabaseError, safeDatabaseErrorDetails } from "../../../src/features/health/service";
import { getEnv } from "../../../src/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let databaseUrl: URL;

  try {
    const env = getEnv();
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    return NextResponse.json(
      {
        status: "error",
        stage: "environment",
        code: "INVALID_SERVER_ENV",
      },
      { status: 503 },
    );
  }

  try {
    await getDb().execute(sql`select 1 as ok`);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        stage: "database",
        code: classifyDatabaseError(error),
        driver: safeDatabaseErrorDetails(error),
        connection: {
          transactionPooler: databaseUrl.hostname.endsWith(".pooler.supabase.com"),
          port: databaseUrl.port || "5432",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    environment: "ok",
    database: "ok",
    connection: {
      transactionPooler: databaseUrl.hostname.endsWith(".pooler.supabase.com"),
      port: databaseUrl.port || "5432",
    },
  });
}
