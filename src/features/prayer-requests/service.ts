import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { prayerRequestComments, prayerRequests, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type {
  AdminPrayerRequestDetail,
  AdminPrayerRequestSummary,
  PrayerRequestStatus,
  OwnPrayerRequest,
  PrayerCommentPage,
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
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(prayerRequests).values({
      userId,
      content: normalized,
      status: "received",
    }).returning({ id: prayerRequests.id });
    return created.id;
  });
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
      completedByRequester: prayerRequests.completedByRequester,
      completedAt: prayerRequests.completedAt,
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
    completedByRequester: row.completedByRequester,
    completedAt: row.completedAt?.toISOString() ?? null,
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
      completedByRequester: prayerRequests.completedByRequester,
      completedAt: prayerRequests.completedAt,
    })
    .from(prayerRequests)
    .innerJoin(users, eq(users.id, prayerRequests.userId))
    .where(eq(prayerRequests.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    requesterName: row.requesterName,
    completedByRequester: row.completedByRequester,
    completedAt: row.completedAt?.toISOString() ?? null,
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
      version: sql`${prayerRequests.version} + 1`,
      ...(parsed !== "completed" ? { completedByRequester: false, completedAt: null } : {}),
    })
    .where(eq(prayerRequests.id, id))
    .returning({ id: prayerRequests.id });

  if (updated.length === 0) {
    throw new DomainError("PRAYER_REQUEST_NOT_FOUND", 404);
  }
}

export async function deletePrayerRequest(id: string): Promise<void> {
  await getDb().delete(prayerRequests).where(eq(prayerRequests.id, id));
}

type Actor = { id: string; role: "member" | "admin" };
type Transaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export function assertPrayerAccess(ownerId: string, actor: Actor) {
  // Return the same response for a missing request and another member's request.
  if (ownerId !== actor.id && actor.role !== "admin") {
    throw new DomainError("PRAYER_REQUEST_NOT_FOUND", 404);
  }
}

export function normalizePrayerComment(value: string) {
  const content = value.trim();
  if (!content || content.length > 2000) throw new DomainError("INVALID_PRAYER_COMMENT", 400);
  return content;
}

async function lockedRequest(tx: Transaction, id: string, actor: Actor, ownerOnly = false) {
  const [row] = await tx.select().from(prayerRequests).where(eq(prayerRequests.id, id)).limit(1).for("update");
  if (!row || (ownerOnly && row.userId !== actor.id)) throw new DomainError("PRAYER_REQUEST_NOT_FOUND", 404);
  assertPrayerAccess(row.userId, actor);
  return row;
}

export async function listOwnPrayerRequests(userId: string, page = 0): Promise<{ requests: OwnPrayerRequest[]; hasMore: boolean }> {
  const rows = await getDb().select({
    id: prayerRequests.id, content: prayerRequests.content, status: prayerRequests.status,
    createdAt: prayerRequests.createdAt, version: prayerRequests.version,
    completedByRequester: prayerRequests.completedByRequester,
    hasUnreadComments: sql<boolean>`exists (
      select 1 from ${prayerRequestComments}
      where ${prayerRequestComments.requestId} = ${prayerRequests.id}
        and ${prayerRequestComments.authorRole} = 'admin'
        and ${prayerRequestComments.authorUserId} <> ${prayerRequests.userId}
        and ${prayerRequestComments.sequence} > ${prayerRequests.requesterReadSequence}
    )`,
  }).from(prayerRequests).where(eq(prayerRequests.userId, userId))
    .orderBy(desc(prayerRequests.createdAt), desc(prayerRequests.id)).limit(11).offset(page * 10);
  return {
    requests: rows.slice(0, 10).map(row => ({ ...row, status: row.status as PrayerRequestStatus, createdAt: row.createdAt.toISOString() })),
    hasMore: rows.length > 10,
  };
}

export async function updateOwnPrayerRequest(id: string, actor: Actor, input: { content: string; expectedVersion: number } | { complete: true }) {
  await getDb().transaction(async tx => {
    const row = await lockedRequest(tx, id, actor, true);
    if ("content" in input) {
      if (row.version !== input.expectedVersion) throw new DomainError("PRAYER_REQUEST_CONFLICT", 409);
      await tx.update(prayerRequests).set({
        content: normalizePrayerRequestContent(input.content),
        version: row.version + 1, updatedAt: new Date(),
      }).where(eq(prayerRequests.id, id));
    } else {
      // Completion is idempotent. Preserve who completed an already completed request.
      if (row.status === "completed") return;
      await tx.update(prayerRequests).set({
        status: "completed", completedByRequester: true, completedAt: new Date(),
        version: row.version + 1, updatedAt: new Date(),
      }).where(eq(prayerRequests.id, id));
    }
  });
}

export async function listPrayerComments(id: string, actor: Actor, before?: number): Promise<PrayerCommentPage> {
  const [request] = await getDb().select({ userId: prayerRequests.userId }).from(prayerRequests)
    .where(eq(prayerRequests.id, id)).limit(1);
  if (!request) throw new DomainError("PRAYER_REQUEST_NOT_FOUND", 404);
  assertPrayerAccess(request.userId, actor);
  const rows = await getDb().select({
    id: prayerRequestComments.id, content: prayerRequestComments.content,
    authorName: users.displayName, authorRole: prayerRequestComments.authorRole,
    authorUserId: prayerRequestComments.authorUserId, sequence: prayerRequestComments.sequence,
    createdAt: prayerRequestComments.createdAt,
  }).from(prayerRequestComments).innerJoin(users, eq(users.id, prayerRequestComments.authorUserId))
    .where(and(eq(prayerRequestComments.requestId, id), before ? lt(prayerRequestComments.sequence, before) : undefined))
    .orderBy(desc(prayerRequestComments.sequence)).limit(51);
  return { comments: rows.slice(0, 50).reverse().map(({ authorUserId, createdAt, ...row }) => ({
    ...row, isOwn: authorUserId === actor.id, createdAt: createdAt.toISOString(),
  })), hasMore: rows.length > 50 };
}

export async function addPrayerComment(id: string, actor: Actor, content: string, clientId: string) {
  const normalized = normalizePrayerComment(content);
  return getDb().transaction(async tx => {
    // Serialize inserts per request so a read cursor can never skip an uncommitted earlier comment.
    await lockedRequest(tx, id, actor);
    const [row] = await tx.insert(prayerRequestComments).values({
      requestId: id, authorUserId: actor.id, authorRole: actor.role, content: normalized, clientId,
    }).onConflictDoNothing().returning({ id: prayerRequestComments.id });
    if (row) return row.id;
    const [existing] = await tx.select({ id: prayerRequestComments.id }).from(prayerRequestComments)
      .where(and(eq(prayerRequestComments.requestId, id), eq(prayerRequestComments.authorUserId, actor.id), eq(prayerRequestComments.clientId, clientId)));
    return existing.id;
  });
}

export async function markPrayerCommentsRead(id: string, actor: Actor, throughCommentId: string) {
  await getDb().transaction(async tx => {
    await lockedRequest(tx, id, actor, true);
    const [comment] = await tx.select({ sequence: prayerRequestComments.sequence }).from(prayerRequestComments)
      .where(and(eq(prayerRequestComments.id, throughCommentId), eq(prayerRequestComments.requestId, id))).limit(1);
    if (!comment) throw new DomainError("INVALID_PRAYER_COMMENT", 400);
    await tx.update(prayerRequests).set({
      requesterReadSequence: sql`greatest(${prayerRequests.requesterReadSequence}, ${comment.sequence})`,
    }).where(eq(prayerRequests.id, id));
  });
}
