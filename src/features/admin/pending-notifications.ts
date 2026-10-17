import { sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { parseActivityPage } from "./metrics-policy";
import type { AdminActivityItem } from "./hub-service";

const PAGE_SIZE = 5;
type PendingPage = {
  total: number; pages: number; page: number;
  prayer: number; visits: number; reports: number; items: AdminActivityItem[];
};

/** Filter before counting/paging. One statement keeps rows and totals on the
 * same snapshot, even when another administrator completes a request. */
export async function getPendingNotifications(page = 1) {
  parseActivityPage(String(page));
  const result = await getDb().execute(sql`
    with activity as (
      select q.id, 'prayer_request'::text as kind,
        (case q.status when 'praying' then '기도중' else '기도요청 접수' end) || ' · ' || u.display_name as label,
        '/admin/prayer-requests?id=' || q.id as href, q.created_at as occurred_at
      from prayer_app.prayer_requests q join prayer_app.users u on u.id=q.user_id
      where q.status in ('received','praying')
      union all
      select v.id, 'visit',
        (case v.status when 'confirmed' then '심방 확정' else '심방 신청' end) || ' · ' || u.display_name || ' · ' || v.visit_date::text,
        '/admin/visits?id=' || v.id, v.created_at
      from prayer_app.visit_requests v join prayer_app.users u on u.id=v.requester_user_id
      where v.status in ('requested','confirmed')
      union all
      select p.id, 'pastoral_report', '목양지 미확인 · ' || p.sam_name || '샘 · ' || p.submitted_by,
        '/admin/pastoral-reports?id=' || p.id, p.submitted_at
      from prayer_app.pastoral_reports p
      where p.submitted_at is not null and p.reviewed_version < p.version
    ), totals as (
      select count(*)::int as total,
        count(*) filter (where kind='prayer_request')::int as prayer,
        count(*) filter (where kind='visit')::int as visits,
        count(*) filter (where kind='pastoral_report')::int as reports
      from activity
    ), pagination as (
      select *, greatest(1,ceil(total::numeric/${PAGE_SIZE})::int) as pages,
        least(${page}::int,greatest(1,ceil(total::numeric/${PAGE_SIZE})::int)) as page
      from totals
    ), selected as (
      select * from activity order by occurred_at desc, kind asc, id desc
      limit ${PAGE_SIZE} offset (select (page-1)*${PAGE_SIZE} from pagination)
    )
    select pagination.*,
      coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'label',label,'href',href,
        'occurredAt',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        order by occurred_at desc,kind asc,id desc) from selected),'[]'::jsonb) as items
    from pagination
  `);
  const row = result.rows[0] as PendingPage;
  return {
    recentActivity: row.items,
    activityPagination: { total: row.total, pages: row.pages, page: row.page, pageSize: PAGE_SIZE },
    counts: { prayer: row.prayer, visits: row.visits, reports: row.reports },
  };
}
