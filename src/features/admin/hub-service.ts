import {
  and,
  desc,
  eq,
  gte,
  lt,
  sql,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  challenges,
  notices,
  prayerCheckins,
  prayerRequests,
  users,
  visitRequests,
} from "../../db/schema";
import { addDays, todayInSeoul } from "../challenge/date";

export type AdminActivityItem = {
  kind: "notice" | "visit" | "prayer_request";
  label: string;
  href: string;
  occurredAt: string;
};

export type AdminHubDashboardData = {
  prayer: {
    participants: number;
    todayCompleted: number;
    todayRate: number;
  };
  visits: {
    requested: number;
    confirmedThisWeek: number;
  };
  prayerRequests: {
    received: number;
    praying: number;
  };
  notices: {
    published: number;
    latestTitle: string | null;
    latestPublishedAt: string | null;
  };
  recentActivity: AdminActivityItem[];
};

export function projectPrayerRequestActivity(input: {
  id: string;
  requesterName: string;
  content?: string;
  status: string;
  createdAt: Date;
}): AdminActivityItem {
  return {
    kind: "prayer_request",
    label: "새 기도요청 · " + input.requesterName,
    href: "/admin/prayer-requests?id=" + input.id,
    occurredAt: input.createdAt.toISOString(),
  };
}

export function projectVisitActivity(input: {
  id: string;
  requesterName: string;
  visitDate: string;
  reason?: string;
  status: string;
  createdAt: Date;
}): AdminActivityItem {
  const prefix =
    input.status === "confirmed"
      ? "심방 확정"
      : input.status === "completed"
        ? "심방 완료"
        : input.status === "cancelled"
          ? "심방 취소"
          : "새 심방 신청";

  return {
    kind: "visit",
    label: prefix + " · " + input.requesterName + " · " + input.visitDate,
    href: "/admin/visits?id=" + input.id,
    occurredAt: input.createdAt.toISOString(),
  };
}

export function mergeRecentActivities(
  rows: AdminActivityItem[],
  limit = 8,
): AdminActivityItem[] {
  return [...rows]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, Math.max(0, limit));
}

function weekRangeInSeoul(now: Date) {
  const today = todayInSeoul(now);
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  const start = addDays(today, -weekday);
  return {
    start,
    endExclusive: addDays(start, 7),
  };
}

export async function getAdminHubDashboard(
  now = new Date(),
): Promise<AdminHubDashboardData> {
  const db = getDb();
  const today = todayInSeoul(now);
  const week = weekRangeInSeoul(now);

  const [participantRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isActive, true));
  const participants = Number(participantRow?.count ?? 0);

  const [activeChallenge] = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.isActive, true))
    .limit(1);

  let todayCompleted = 0;
  if (activeChallenge) {
    const [todayRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prayerCheckins)
      .innerJoin(users, eq(users.id, prayerCheckins.userId))
      .where(
        and(
          eq(prayerCheckins.challengeId, activeChallenge.id),
          eq(prayerCheckins.prayerDate, today),
          eq(users.isActive, true),
        ),
      );
    todayCompleted = Number(todayRow?.count ?? 0);
  }

  const [requestedVisitRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(visitRequests)
    .where(eq(visitRequests.status, "requested"));

  const [confirmedVisitRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(visitRequests)
    .where(
      and(
        eq(visitRequests.status, "confirmed"),
        gte(visitRequests.visitDate, week.start),
        lt(visitRequests.visitDate, week.endExclusive),
      ),
    );

  const [receivedPrayerRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prayerRequests)
    .where(eq(prayerRequests.status, "received"));

  const [prayingPrayerRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(prayerRequests)
    .where(eq(prayerRequests.status, "praying"));

  const [publishedNoticeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notices)
    .where(eq(notices.status, "published"));

  const [latestNotice] = await db
    .select({
      title: notices.title,
      publishedAt: notices.publishedAt,
    })
    .from(notices)
    .where(eq(notices.status, "published"))
    .orderBy(desc(notices.publishedAt), desc(notices.createdAt))
    .limit(1);

  const visitRows = await db
    .select({
      id: visitRequests.id,
      requesterName: users.displayName,
      visitDate: visitRequests.visitDate,
      status: visitRequests.status,
      createdAt: visitRequests.createdAt,
    })
    .from(visitRequests)
    .innerJoin(users, eq(users.id, visitRequests.requesterUserId))
    .orderBy(desc(visitRequests.createdAt))
    .limit(5);

  const prayerRows = await db
    .select({
      id: prayerRequests.id,
      requesterName: users.displayName,
      status: prayerRequests.status,
      createdAt: prayerRequests.createdAt,
    })
    .from(prayerRequests)
    .innerJoin(users, eq(users.id, prayerRequests.userId))
    .orderBy(desc(prayerRequests.createdAt))
    .limit(5);

  const noticeRows = await db
    .select({
      id: notices.id,
      title: notices.title,
      publishedAt: notices.publishedAt,
      createdAt: notices.createdAt,
    })
    .from(notices)
    .where(eq(notices.status, "published"))
    .orderBy(desc(notices.publishedAt), desc(notices.createdAt))
    .limit(5);

  const recentActivity = mergeRecentActivities([
    ...visitRows.map(projectVisitActivity),
    ...prayerRows.map(projectPrayerRequestActivity),
    ...noticeRows.map((row): AdminActivityItem => ({
      kind: "notice",
      label: "공지 발행 · " + row.title,
      href: "/admin/notices?id=" + row.id,
      occurredAt: (row.publishedAt ?? row.createdAt).toISOString(),
    })),
  ]);

  return {
    prayer: {
      participants,
      todayCompleted,
      todayRate: participants > 0 ? todayCompleted / participants : 0,
    },
    visits: {
      requested: Number(requestedVisitRow?.count ?? 0),
      confirmedThisWeek: Number(confirmedVisitRow?.count ?? 0),
    },
    prayerRequests: {
      received: Number(receivedPrayerRow?.count ?? 0),
      praying: Number(prayingPrayerRow?.count ?? 0),
    },
    notices: {
      published: Number(publishedNoticeRow?.count ?? 0),
      latestTitle: latestNotice?.title ?? null,
      latestPublishedAt: latestNotice?.publishedAt?.toISOString() ?? null,
    },
    recentActivity,
  };
}
