import { expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
vi.mock("server-only", () => ({}));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));
import { getDb } from "../../src/db/client";
import { hasUnreadPrayerComments, listOwnPrayerRequests } from "../../src/features/prayer-requests/service";

it("correlates the unread subquery with the outer request instead of the comment's id", async () => {
  const pool = new Pool();
  const query = vi.spyOn(pool, "query").mockImplementation(async () => ({ rows: [] }) as never);
  vi.mocked(getDb).mockReturnValue(drizzle(pool));
  await listOwnPrayerRequests("00000000-0000-4000-8000-000000000001");
  const sql = (query.mock.calls[0][0] as unknown as { text: string }).text;
  expect(sql).toContain('"prayer_app"."prayer_requests".id');
  expect(sql).not.toContain("author_user_id <>");
  expect(sql).toContain("c.author_role = 'admin'");
  expect(sql).toContain('"prayer_app"."prayer_requests".requester_read_sequence');
  await pool.end();
});

it("checks all of the session owner's requests without fetching prayer contents or paginating", async () => {
  const pool = new Pool();
  const query = vi.spyOn(pool, "query").mockImplementation(async () => ({ rows: [] }) as never);
  vi.mocked(getDb).mockReturnValue(drizzle(pool));
  const owner = "00000000-0000-4000-8000-000000000001";
  expect(await hasUnreadPrayerComments(owner)).toBe(false);
  const sql = (query.mock.calls[0][0] as unknown as { text: string }).text;
  expect(sql).toContain('"prayer_requests"."user_id" = $1');
  expect(sql).toContain('c.sequence > "prayer_app"."prayer_requests".requester_read_sequence');
  expect(sql).toContain("c.author_role = 'admin'");
  expect(sql).not.toMatch(/offset|content|author_user_id <>/);
  expect(query.mock.calls[0][1]).toEqual([owner, 1]);
  query.mockImplementation(async () => ({ rows: [[owner]] }) as never);
  expect(await hasUnreadPrayerComments(owner)).toBe(true);
  await pool.end();
});
