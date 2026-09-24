import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { noticeReads, notices, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type {
  AdminNoticeInput,
  AdminNoticeRow,
  MemberNoticeDetail,
  MemberNoticeSummary,
  NoticeStatus,
} from "./types";

export function canMemberReadNotice(notice: { status: string }): boolean {
  return notice.status === "published";
}

export function transitionNoticePublication(
  current: NoticeStatus,
  next: NoticeStatus,
): { nextStatus: NoticeStatus; didPublish: boolean } {
  return {
    nextStatus: next,
    didPublish: current !== "published" && next === "published",
  };
}

function normalizeNoticeInput(input: AdminNoticeInput): AdminNoticeInput {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new DomainError("INVALID_NOTICE", 400);
  if (title.length > 200) throw new DomainError("NOTICE_TITLE_TOO_LONG", 400);
  return { title, body, status: input.status };
}

function memberSummary(row: {
  id: string;
  title: string;
  publishedAt: Date | null;
  readAt: Date | null;
}): MemberNoticeSummary {
  return {
    id: row.id,
    title: row.title,
    publishedAt: row.publishedAt?.toISOString() ?? "",
    isUnread: row.readAt === null,
  };
}

export async function listPublishedNotices(
  userId: string,
): Promise<MemberNoticeSummary[]> {
  const rows = await getDb()
    .select({
      id: notices.id,
      title: notices.title,
      publishedAt: notices.publishedAt,
      readAt: noticeReads.readAt,
    })
    .from(notices)
    .leftJoin(
      noticeReads,
      and(
        eq(noticeReads.noticeId, notices.id),
        eq(noticeReads.userId, userId),
      ),
    )
    .where(eq(notices.status, "published"))
    .orderBy(desc(notices.publishedAt), desc(notices.createdAt));

  return rows.map(memberSummary);
}

export async function getPublishedNoticeForUser(
  noticeId: string,
  userId: string,
): Promise<MemberNoticeDetail | null> {
  const [row] = await getDb()
    .select({
      id: notices.id,
      title: notices.title,
      body: notices.body,
      publishedAt: notices.publishedAt,
      readAt: noticeReads.readAt,
    })
    .from(notices)
    .leftJoin(
      noticeReads,
      and(
        eq(noticeReads.noticeId, notices.id),
        eq(noticeReads.userId, userId),
      ),
    )
    .where(
      and(
        eq(notices.id, noticeId),
        eq(notices.status, "published"),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    ...memberSummary(row),
    body: row.body,
  };
}

export async function markNoticeRead(
  noticeId: string,
  userId: string,
): Promise<void> {
  await getDb()
    .insert(noticeReads)
    .values({ noticeId, userId })
    .onConflictDoNothing();
}

export async function getUnreadNoticeCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(notices)
    .leftJoin(
      noticeReads,
      and(
        eq(noticeReads.noticeId, notices.id),
        eq(noticeReads.userId, userId),
      ),
    )
    .where(
      and(
        eq(notices.status, "published"),
        isNull(noticeReads.readAt),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function createNotice(
  authorUserId: string,
  input: AdminNoticeInput,
  now = new Date(),
) {
  const normalized = normalizeNoticeInput(input);
  const didPublish = normalized.status === "published";
  const [created] = await getDb()
    .insert(notices)
    .values({
      ...normalized,
      authorUserId,
      publishedAt: didPublish ? now : null,
      updatedAt: now,
    })
    .returning({
      id: notices.id,
      title: notices.title,
      body: notices.body,
      status: notices.status,
      publishedAt: notices.publishedAt,
    });

  return {
    notice: created,
    didPublish,
  };
}

export async function updateNotice(
  id: string,
  input: AdminNoticeInput,
  now = new Date(),
) {
  const normalized = normalizeNoticeInput(input);
  const [existing] = await getDb()
    .select({
      status: notices.status,
      publishedAt: notices.publishedAt,
    })
    .from(notices)
    .where(eq(notices.id, id))
    .limit(1);

  if (!existing) throw new DomainError("NOTICE_NOT_FOUND", 404);

  const transition = transitionNoticePublication(
    existing.status as NoticeStatus,
    normalized.status,
  );

  const [updated] = await getDb()
    .update(notices)
    .set({
      title: normalized.title,
      body: normalized.body,
      status: normalized.status,
      publishedAt: transition.didPublish ? now : existing.publishedAt,
      updatedAt: now,
    })
    .where(eq(notices.id, id))
    .returning({
      id: notices.id,
      title: notices.title,
      body: notices.body,
      status: notices.status,
      publishedAt: notices.publishedAt,
    });

  return {
    notice: updated,
    didPublish: transition.didPublish,
  };
}

export async function deleteNotice(id: string): Promise<void> {
  const deleted = await getDb()
    .delete(notices)
    .where(eq(notices.id, id))
    .returning({ id: notices.id });
  if (deleted.length === 0) throw new DomainError("NOTICE_NOT_FOUND", 404);
}

export async function listNoticesForAdmin(): Promise<AdminNoticeRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: notices.id,
      title: notices.title,
      body: notices.body,
      status: notices.status,
      publishedAt: notices.publishedAt,
      createdAt: notices.createdAt,
      updatedAt: notices.updatedAt,
    })
    .from(notices)
    .orderBy(desc(notices.createdAt));

  const readRows = await db
    .select({
      noticeId: noticeReads.noticeId,
      count: sql<number>`count(*)::int`,
    })
    .from(noticeReads)
    .groupBy(noticeReads.noticeId);

  const [targetRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isActive, true));

  const readCount = new Map(
    readRows.map((row) => [row.noticeId, Number(row.count)]),
  );
  const targetActiveUsers = Number(targetRow?.count ?? 0);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status as NoticeStatus,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readCount: readCount.get(row.id) ?? 0,
    targetActiveUsers,
  }));
}
