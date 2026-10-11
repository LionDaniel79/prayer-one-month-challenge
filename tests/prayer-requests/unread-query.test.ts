import { expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
vi.mock("server-only", () => ({}));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));
import { getDb } from "../../src/db/client";
import { listOwnPrayerRequests } from "../../src/features/prayer-requests/service";

it("correlates the unread subquery with the outer request instead of the comment's id", async () => {
  const pool = new Pool();
  const query = vi.spyOn(pool, "query").mockImplementation(async () => ({ rows: [] }) as never);
  vi.mocked(getDb).mockReturnValue(drizzle(pool));
  await listOwnPrayerRequests("00000000-0000-4000-8000-000000000001");
  const sql = (query.mock.calls[0][0] as unknown as { text: string }).text;
  expect(sql).toContain('"prayer_app"."prayer_requests".id');
  expect(sql).toContain('"prayer_app"."prayer_requests".user_id');
  expect(sql).toContain('"prayer_app"."prayer_requests".requester_read_sequence');
  await pool.end();
});
