import { afterEach, describe, expect, it, vi } from "vitest";
import { Client, type PoolClient } from "pg";
import { closeDb, getDb } from "../../src/db/client";

const config = vi.hoisted(() => ({ url: "postgresql://test:test@localhost/test" }));
vi.mock("../../src/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: config.url }) }));

afterEach(async () => {
  vi.restoreAllMocks();
  await closeDb();
  config.url = "postgresql://test:test@localhost/test";
});

describe("pooled transaction cleanup", () => {
  it("discards an acquired connection when BEGIN times out", async () => {
    const db = getDb();
    const connection = { query: vi.fn().mockRejectedValue(new Error("Query read timeout")), release: vi.fn() };
    vi.spyOn(db.$client as { connect: () => Promise<PoolClient> }, "connect").mockResolvedValue(connection as unknown as PoolClient);
    await expect(db.transaction(async () => undefined)).rejects.toThrow();
    expect(connection.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("discards a connection when rollback fails", async () => {
    const db = getDb();
    const connection = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValue(new Error("Query read timeout")),
      release: vi.fn(),
    };
    vi.spyOn(db.$client as { connect: () => Promise<PoolClient> }, "connect").mockResolvedValue(connection as unknown as PoolClient);
    await expect(db.transaction(async () => { throw new Error("cancel transaction"); })).rejects.toThrow();
    expect(connection.release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("returns a successfully committed connection for reuse", async () => {
    const db = getDb();
    const connection = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    vi.spyOn(db.$client as { connect: () => Promise<PoolClient> }, "connect").mockResolvedValue(connection as unknown as PoolClient);
    await expect(db.transaction(async () => "saved")).resolves.toBe("saved");
    expect(connection.release).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(["require", "disable"])("preserves required TLS when the URL specifies sslmode=%s", (mode) => {
    config.url += `?sslmode=${mode}`;
    const connection = new Client(getDb().$client.options);
    expect((connection as unknown as { ssl: unknown }).ssl).toEqual({ rejectUnauthorized: false });
  });
});
