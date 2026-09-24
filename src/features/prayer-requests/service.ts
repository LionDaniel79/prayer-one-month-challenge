import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { prayerRequests, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type {
  AdminPrayerRequestDetail,
  AdminPrayerRequestSummary,
  PrayerRequestStatus,
} from "./types";

const PRAYER_REQUEST_STATUSES = new Set<PrayerRequestStatus>([
  "received",
  "praying",
  "completed",
]);

export function normalizePrayerRequestContent(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DomainError("INVALID_PRAYER_REQUEST", 400);
  }
  if (normalized.length > 10000) {
    throw new DomainError("PRAYER_REQUEST_TOO_LONG", 400);
  }
  return normalized;
}

export function parsePrayerRequestStatus(value: string): PrayerRequestStatus {
  if (!PRAYER_REQUEST_STATUSES.has(value as PrayerRequestStatus)) {
    throw new DomainError("INVALID_PRAYER_REQUEST_STATUS", 400);
  }
  return value as PrayerRequestStatus;
}

export async function createPrayerRequest(
  userId: string,
  content: string,
): Promise<string> {
  const normalized = normalizePrayerRequestContent(content);
  const [created] = await getDb()
    .insert(prayerRequests)
    .values({
      userId,
      content: normalized,
      status: "received",
    })
    .returning({ id: prayerRequests.id });
  return created.id;
}

export async function listPrayerRequestsForAdmin(
  filter: { status?: PrayerRequestStatus } = {},
): Promise<AdminPrayerRequestSummary[]> {
  const rows = await getDb()
    .select({
      id: prayerRequests.id,
      requesterName: users.displayName,
      content: prayerRequests.content,
      status: prayerRequests.status,
      createdAt: prayerRequests.createdAt,
    })
    .from(prayerRequests)
    .innerJoin(users, eq(users.id, prayerRequests.userId))
    .where(
      filter.status
        ? eq(prayerRequests.status, filter.status)
        : sql`true`,
    )
    .orderBy(desc(prayerRequests.createdAt));

  return rows.map((row) => ({
    id: row.id,
    requesterName: row.requesterName,
    createdAt: row.createdAt.toISOString(),
    status: row.status as PrayerRequestStatus,
    preview:
      row.content.length > 120
        ? row.content.slice(0, 120) + "…"
        : row.content,
  }));
}

export async function getPrayerRequestForAdmin(
  id: string,
): Promise<AdminPrayerRequestDetail | null> {
  const [row] = await getDb()
    .select({
      id: prayerRequests.id,
      requesterName: users.displayName,
      content: prayerRequests.content,
      status: prayerRequests.status,
      createdAt: prayerRequests.createdAt,
    })
    .from(prayerRequests)
    .innerJoin(users, eq(users.id, prayerRequests.userId))
    .where(eq(prayerRequests.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    requesterName: row.requesterName,
    createdAt: row.createdAt.toISOString(),
    status: row.status as PrayerRequestStatus,
    preview:
      row.content.length > 120
        ? row.content.slice(0, 120) + "…"
        : row.content,
    content: row.content,
  };
}

export async function updatePrayerRequestStatus(
  id: string,
  status: PrayerRequestStatus,
): Promise<void> {
  const parsed = parsePrayerRequestStatus(status);
  const updated = await getDb()
    .update(prayerRequests)
    .set({
      status: parsed,
      updatedAt: new Date(),
    })
    .where(eq(prayerRequests.id, id))
    .returning({ id: prayerRequests.id });

  if (updated.length === 0) {
    throw new DomainError("PRAYER_REQUEST_NOT_FOUND", 404);
  }
}
