import { getDb, rows, sql } from "./db";
import { directory, requireReportAdmin, reportAccess } from "./access";
import { countMissing, int, parseSchedule, periodLabel, reportId, seoulToday, ReportError, type Actor, type ReportRequest } from "./policy";
export const requestColumns = sql`id,year,month,enabled`;
export async function getSchedule(actor: Actor, year: number) {
  requireReportAdmin(actor); int(year, 2000, 9998);
  // Read the version and month selection from a single PostgreSQL snapshot.
  const [snapshot] = await rows<{ version: number; requests: ReportRequest[] }>(getDb(), sql`
    select coalesce((select version from prayer_app.pastoral_schedule_versions where year=${year}),0)::int as version,
      coalesce((select json_agg(json_build_object('id',id,'year',year,'month',month,'enabled',enabled) order by month)
        from prayer_app.pastoral_requests where year=${year}),'[]'::json) as requests`);
  return { year, currentYear: Number(seoulToday().slice(0, 4)), ...snapshot };
}
export async function saveSchedule(actor: Actor, input: unknown) {
  requireReportAdmin(actor);
  const config = parseSchedule(input);
  await getDb().transaction(async tx => {
    await tx.execute(sql`insert into prayer_app.pastoral_schedule_versions(year) values(${config.year}) on conflict do nothing`);
    const [current] = await rows<{ version: number }>(tx, sql`select version from prayer_app.pastoral_schedule_versions where year=${config.year} for update`);
    if (current.version !== config.expectedVersion) throw new ReportError("SCHEDULE_CHANGED", 409);
    // Deactivate instead of deleting. Received reports retain their request identity.
    await tx.execute(sql`update prayer_app.pastoral_requests set enabled=false,updated_at=now() where year=${config.year}`);
    for (const p of config.selected) {
      await tx.execute(sql`insert into prayer_app.pastoral_requests(year,month,created_by) values(${config.year},${p.month},${actor.id}) on conflict(year,month) do update set enabled=true,updated_at=now()`);
    }
    await tx.execute(sql`update prayer_app.pastoral_schedule_versions set version=version+1 where year=${config.year}`);
  });
  return getSchedule(actor, config.year);
}
export async function pastoralStatus(actor: Actor) {
  const access = await reportAccess(actor);
  if (!access.visible) return { visible: false, count: 0, sams: [], requiredSamIds: [], requests: [], completed: [], today: seoulToday() };
  const requests = await rows<ReportRequest>(getDb(), sql`select ${requestColumns} from prayer_app.pastoral_requests where enabled=true order by year desc,month desc`);
  const ids = access.sams.map(s => s.id);
  const completed = ids.length ? await rows<{ requestId: string; samId: string }>(getDb(), sql`select distinct request_id as "requestId",sam_id as "samId" from prayer_app.pastoral_reports where submitted_at is not null and sam_id in (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`) : [];
  const today = seoulToday();
  return { ...access, requests, completed, today, count: countMissing(requests, access.requiredSamIds, completed, today) };
}
export async function requestOverview(actor: Actor, requestId: string) {
  requireReportAdmin(actor); reportId(requestId);
  const [request] = await rows<ReportRequest>(getDb(), sql`select ${requestColumns} from prayer_app.pastoral_requests where id=${requestId}`);
  if (!request) throw new ReportError("REQUEST_NOT_FOUND", 404);
  const [data, submitted] = await Promise.all([
    directory(),
    rows<{ id: string; samId: string; samName: string; leaderName: string; submittedBy: string; method: string; submittedAt: string }>(getDb(), sql`select id,sam_id as "samId",sam_name as "samName",leader_name as "leaderName",submitted_by as "submittedBy",method,to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "submittedAt" from prayer_app.pastoral_reports where request_id=${requestId} and submitted_at is not null order by submitted_at desc,id desc`),
  ]);
  const targets = data.sams.filter(s => s.isActive && s.leaderName);
  const overview = targets.map(sam => ({ sam, submitted: submitted.find(r => r.samId === sam.id) ?? null, count: submitted.filter(r => r.samId === sam.id).length }));
  // Reports for retired or formerly unassigned sams still remain accessible.
  for (const row of submitted.filter((r,i,all) => !targets.some(s => s.id === r.samId) && all.findIndex(v => v.samId === r.samId) === i)) overview.push({ sam: { id: row.samId, name: row.samName, leaderName: row.leaderName, village: "", isActive: false }, submitted: row, count: submitted.filter(r => r.samId === row.samId).length });
  return { request, label: periodLabel(request), rows: overview };
}
