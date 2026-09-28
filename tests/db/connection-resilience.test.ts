import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../../src/db/client";

// Only the disposable PostgreSQL used by browser tests may run these probes.
describe.skipIf(process.env.E2E_DATABASE_READY !== "1")("database connection resilience", () => {
  if (process.env.E2E_DATABASE_READY === "1" &&
      !["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) {
    throw new Error("Database resilience probes require a disposable loopback database");
  }
  afterAll(closeDb);

  it("commits a transaction using one acquired connection", async () => {
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(sql`create temporary table connection_probe (value integer) on commit drop`);
      await tx.execute(sql`insert into connection_probe values (42)`);
      return tx.execute(sql`select value from connection_probe`);
    });
    expect(result.rows).toEqual([{ value: 42 }]);
  });

  it("serves a short query while another request is waiting on the database", async () => {
    await getDb().execute(sql`select 1`);
    const slow = getDb().execute(sql`select pg_sleep(1)`).then(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const started = performance.now();
    await getDb().execute(sql`select 1`);
    const elapsed = performance.now() - started;
    await slow;
    expect(elapsed).toBeLessThan(700);
  });

  it("bounds stalled queries and remains usable after a timeout", async () => {
    const started = performance.now();
    await expect(getDb().execute(sql`select pg_sleep(20)`)).rejects.toThrow();
    expect(performance.now() - started).toBeLessThan(15_000);
    await expect(getDb().execute(sql`select 1`)).resolves.toBeDefined();
  }, 25_000);
});
