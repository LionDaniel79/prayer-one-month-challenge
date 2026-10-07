import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { challenges, memberRoster, prayerCheckins, prayerRequests, users, visitRequests } from "../../db/schema";
import { todayInSeoul } from "../challenge/date";
import { getPrayerMenuSettings } from "../prayer-menu/service";
import { ACTIVITY_PAGE_SIZE, activityPagination } from "./metrics-policy";
import { prayerParticipantHasCheckin, prayerParticipantNotExcluded } from "./prayer-participants";

export type AdminActivityItem = {
  kind: "notice" | "visit" | "prayer_request" | "pastoral_report";
  label: string;
  href: string;
  occurredAt: string;
};
export type AdminHubDashboardData = {
  prayer: { enabled: boolean; participants: number; todayCompleted: number; todayRate: number };
  users: { active: number; registered: number };
  visits: { requested: number };
  prayerRequests: { received: number; praying: number };
  pastoral: { unreviewed: number };
  recentActivity: AdminActivityItem[];
  activityPagination: { page: number; pages: number; total: number; pageSize: number };
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
  limit = 10,
): AdminActivityItem[] {
  return [...rows]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.kind.localeCompare(b.kind) || a.href.localeCompare(b.href))
    .slice(0, Math.max(0, limit));
}


/** Counts and the selected page share a SQL snapshot, with a stable tie-breaker.
 * Select metadata only: never put prayer/visit/report bodies or file data into the feed.
 */
async function recentActivityPage(page: number) {
  activityPagination(page, 0); // Validate before interpolating the requested page.
  const result = await getDb().execute(sql`
    with activity as (
      select n.id, 'notice'::text as kind, '공지 발행 · ' || n.title as label,
        '/admin/notices?id=' || n.id as href, coalesce(n.published_at,n.created_at) as occurred_at
      from prayer_app.notices n where n.status='published'
      union all
      select v.id, 'visit',
        (case v.status when 'confirmed' then '심방 확정' when 'completed' then '심방 완료'
         when 'cancelled' then '심방 취소' else '새 심방 신청' end) || ' · ' || u.display_name || ' · ' || v.visit_date::text,
        '/admin/visits?id=' || v.id, v.created_at
      from prayer_app.visit_requests v join prayer_app.users u on u.id=v.requester_user_id
      union all
      select q.id, 'prayer_request', '새 기도요청 · ' || u.display_name,
        '/admin/prayer-requests?id=' || q.id, q.created_at
      from prayer_app.prayer_requests q join prayer_app.users u on u.id=q.user_id
      union all
      select p.id, 'pastoral_report', '목양지 제출 · ' || p.sam_name || '샘 · ' || p.submitted_by,
        '/admin/pastoral-reports?id=' || p.id, p.submitted_at
      from prayer_app.pastoral_reports p where p.submitted_at is not null
    ), totals as (
      select count(*)::int as total from activity
    ), pagination as (
      select total, greatest(1,ceil(total::numeric/${ACTIVITY_PAGE_SIZE})::int) as pages,
        least(${page}::int,greatest(1,ceil(total::numeric/${ACTIVITY_PAGE_SIZE})::int)) as page
      from totals
    ), selected as (
      select * from activity order by occurred_at desc, kind asc, id desc
      limit ${ACTIVITY_PAGE_SIZE} offset (select (page-1)*${ACTIVITY_PAGE_SIZE} from pagination)
    )
    select pagination.*,
      coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'label',label,'href',href,
        'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        order by occurred_at desc,kind asc,id desc) from selected),'[]'::jsonb) as items
    from pagination
  `);
  const row = result.rows[0] as { total: number; pages: number; page: number; items: AdminActivityItem[] };
  return { recentActivity: row.items, activityPagination: {
    total: row.total, pages: row.pages, page: row.page, pageSize: ACTIVITY_PAGE_SIZE,
  } };
}

export async function getAdminHubDashboard(now = new Date(), page = 1): Promise<AdminHubDashboardData> {
  const db = getDb();
  const today = todayInSeoul(now);
  const { enabled } = await getPrayerMenuSettings();
  const [challenge] = await db.select({ id: challenges.id, startDate: challenges.startDate, endDate: challenges.endDate })
    .from(challenges).where(eq(challenges.isActive,true)).limit(1);
  let participants = 0;
  let todayCompleted = 0;
  if (enabled && challenge) {
    const population = and(eq(users.isActive,true), prayerParticipantNotExcluded(challenge.id), prayerParticipantHasCheckin(challenge,today));
    const [participantRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(population);
    participants = Number(participantRow?.count ?? 0);
    if (today >= challenge.startDate && today <= challenge.endDate && new Date(today+'T00:00:00Z').getUTCDay() !== 0) {
      const [todayRow] = await db.select({ count: sql<number>`count(distinct ${users.id})::int` }).from(users)
        .innerJoin(prayerCheckins,eq(prayerCheckins.userId,users.id))
        .where(and(population,eq(prayerCheckins.challengeId,challenge.id),eq(prayerCheckins.prayerDate,today)));
      todayCompleted = Number(todayRow?.count ?? 0);
    }
  }
  const [userRow] = await db.select({
    registered: sql<number>`count(distinct ${memberRoster.id})::int`,
    active: sql<number>`count(distinct ${memberRoster.id}) filter (where ${users.firstLoginAt} is not null)::int`,
  }).from(memberRoster).leftJoin(users,eq(users.rosterId,memberRoster.id));
  const [visits] = await db.select({ count: sql<number>`count(*)::int` }).from(visitRequests).where(eq(visitRequests.status,'requested'));
  const [received] = await db.select({ count: sql<number>`count(*)::int` }).from(prayerRequests).where(eq(prayerRequests.status,'received'));
  const [praying] = await db.select({ count: sql<number>`count(*)::int` }).from(prayerRequests).where(eq(prayerRequests.status,'praying'));
  const unreviewed = await db.execute(sql`select count(*)::int as count from prayer_app.pastoral_reports
    where submitted_at is not null and reviewed_version < version`);
  return {
    prayer: { enabled, participants, todayCompleted, todayRate: participants > 0 ? todayCompleted/participants : 0 },
    users: { active: Number(userRow?.active ?? 0), registered: Number(userRow?.registered ?? 0) },
    visits: { requested: Number(visits?.count ?? 0) },
    prayerRequests: { received: Number(received?.count ?? 0), praying: Number(praying?.count ?? 0) },
    pastoral: { unreviewed: Number((unreviewed.rows[0] as {count:number})?.count ?? 0) },
    ...await recentActivityPage(page),
  };
}
