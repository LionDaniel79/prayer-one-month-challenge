import { createHash } from "node:crypto";
import { getDb, rows, sql, type Executor } from "./db";
import { requireReportAccess, requireReportAdmin, requireReportTarget } from "./access";
import { requestColumns } from "./schedules";
import { rasterPreview } from "./images";
import { CHUNK_LIMIT, chunkSize, int, parseSubmission, periodLabel, photoName, ReportError, reportId, reportText, requestState, type Actor, type ReportRequest, type Submission } from "./policy";
export type StoredReport = Submission & { authorId: string | null; samName: string; village: string; leaderName: string; submittedBy: string; submittedAt: string | null; createdAt: string; fingerprint: string; year: number; month: number };
type StoredSummary = Pick<StoredReport, "id" | "requestId" | "samId" | "samName" | "village" | "leaderName" | "submittedBy" | "method" | "year" | "month"> & { submittedAt: string };
const reportColumns = sql`p.id,p.request_id as "requestId",p.sam_id as "samId",p.author_user_id as "authorId",p.sam_name as "samName",p.village,p.leader_name as "leaderName",p.submitted_by as "submittedBy",p.written_date::text as "writtenDate",p.method,p.form,p.files,p.fingerprint,to_char(p.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "submittedAt",to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",r.year,r.month`;
async function lockedReport(db: Executor, id: string): Promise<StoredReport> {
  const [report] = await rows<StoredReport>(db, sql`select ${reportColumns} from prayer_app.pastoral_reports p join prayer_app.pastoral_requests r on r.id=p.request_id where p.id=${id} for update of p`);
  if (!report) throw new ReportError("REPORT_NOT_FOUND", 404);
  return report;
}
async function openRequest(db: Executor, id: string) {
  const [request] = await rows<ReportRequest>(db, sql`select ${requestColumns} from prayer_app.pastoral_requests where id=${id} for share`);
  if (!request || !request.enabled) throw new ReportError("REQUEST_CLOSED", 409);
  if (requestState(request, false) !== "pending") throw new ReportError("MONTH_CLOSED", 409);
  return request;
}
export async function beginReport(actor: Actor, value: unknown) {
  const input = parseSubmission(value);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return getDb().transaction(async tx => {
    // Serialize per-author creation, so simultaneous tabs cannot exceed draft quota.
    await tx.execute(sql`select id from prayer_app.users where id=${actor.id} for update`);
    const { access, sam } = await requireReportTarget(actor, input.samId, tx);
    const [existing] = await rows<{ id: string; authorId: string | null; fingerprint: string; submittedAt: string | null }>(tx, sql`select id,author_user_id as "authorId",fingerprint,to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "submittedAt" from prayer_app.pastoral_reports where id=${input.id}`);
    if (existing) {
      if (existing.authorId !== actor.id || existing.fingerprint !== fingerprint) throw new ReportError("ID_CONFLICT", 409);
      return { id: existing.id, submitted: !!existing.submittedAt };
    }
    await openRequest(tx, input.requestId);
    await tx.execute(sql`delete from prayer_app.pastoral_reports where submitted_at is null and created_at < now()-interval '24 hours' and (author_user_id=${actor.id} or author_user_id is null)`);
    const [quota] = await rows<{ count: number }>(tx, sql`select count(*)::int as count from prayer_app.pastoral_reports where author_user_id=${actor.id} and submitted_at is null`);
    if (quota.count >= 3) throw new ReportError("DRAFT_LIMIT", 429);
    const [identity] = await rows<{ name: string }>(tx, sql`select coalesce(r.source_name,u.display_name) as name from prayer_app.users u left join prayer_app.member_roster r on r.id=u.roster_id where u.id=${actor.id}`);
    const submittedBy = identity?.name ?? actor.displayName;
    const leaderName = access.requiredSamIds.includes(sam.id) ? submittedBy : sam.leaderName || submittedBy;
    await tx.execute(sql`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,village,leader_name,submitted_by,written_date,method,form,files,fingerprint) values(${input.id},${input.requestId},${input.samId},${actor.id},${sam.name},${sam.village},${leaderName},${submittedBy},${input.writtenDate},${input.method},${input.form ? JSON.stringify(input.form) : null}::jsonb,${JSON.stringify(input.files)}::jsonb,${fingerprint})`);
    return { id: input.id, submitted: false };
  });
}
export async function putReportChunk(actor: Actor, id: string, slot: number, index: number, bytes: Buffer) {
  reportId(id); int(slot, 0, 1); int(index, 0, 11);
  await getDb().transaction(async tx => {
    const report = await lockedReport(tx, id);
    if (report.authorId !== actor.id) throw new ReportError("FORBIDDEN", 403);
    await requireReportTarget(actor, report.samId, tx);
    if (report.submittedAt) throw new ReportError("REPORT_FINALIZED", 409);
    if (Date.now() - new Date(report.createdAt).getTime() > 24 * 3600000) throw new ReportError("DRAFT_EXPIRED", 409);
    await openRequest(tx, report.requestId);
    const file = report.files[slot];
    if (!file || bytes.length !== chunkSize(file.size, index)) throw new ReportError("INVALID_CHUNK");
    await tx.execute(sql`insert into prayer_app.pastoral_report_chunks(report_id,slot,chunk_index,data) values(${id},${slot},${index},${bytes}) on conflict(report_id,slot,chunk_index) do update set data=excluded.data`);
  });
}
async function readFile(db: Executor, report: StoredReport, slot: number): Promise<Buffer> {
  const file = report.files[slot];
  if (!file) throw new ReportError("FILE_NOT_FOUND", 404);
  const chunks = await rows<{ index: number; data: Buffer }>(db, sql`select chunk_index as index,data from prayer_app.pastoral_report_chunks where report_id=${report.id} and slot=${slot} order by chunk_index`);
  if (chunks.length !== Math.ceil(file.size / CHUNK_LIMIT)) throw new ReportError("UPLOAD_INCOMPLETE", 409);
  for (let i = 0; i < chunks.length; i++) if (chunks[i].index !== i || chunks[i].data.length !== chunkSize(file.size, i)) throw new ReportError("FILE_INTEGRITY_FAILED", 409);
  const buffer = Buffer.concat(chunks.map(c => c.data));
  if (buffer.length !== file.size || createHash("sha256").update(buffer).digest("hex") !== file.sha256) throw new ReportError("FILE_INTEGRITY_FAILED", 409);
  return buffer;
}
export async function publishReport(actor: Actor, id: string) {
  reportId(id);
  await getDb().transaction(async tx => {
    const report = await lockedReport(tx, id);
    if (report.authorId !== actor.id) throw new ReportError("FORBIDDEN", 403);
    await requireReportTarget(actor, report.samId, tx);
    if (report.submittedAt) return; // Lost response: repeated commit never creates a second report.
    if (Date.now() - new Date(report.createdAt).getTime() > 24 * 3600000) throw new ReportError("DRAFT_EXPIRED", 409);
    await openRequest(tx, report.requestId);
    for (let slot = 0; slot < report.files.length; slot++) {
      const bytes = await readFile(tx, report, slot);
      if (report.method === "photo") await rasterPreview(bytes);
    }
    await tx.execute(sql`update prayer_app.pastoral_reports set submitted_at=now() where id=${id}`);
  });
  return { id, submitted: true };
}
export async function cancelDraft(actor: Actor, id: string) {
  reportId(id);
  await requireReportAccess(actor);
  await getDb().transaction(async tx => {
    const report = await lockedReport(tx, id);
    if (report.authorId !== actor.id) throw new ReportError("FORBIDDEN", 403);
    if (report.submittedAt) throw new ReportError("REPORT_FINALIZED", 409);
    await tx.execute(sql`delete from prayer_app.pastoral_reports where id=${id} and author_user_id=${actor.id} and submitted_at is null`);
  });
}
export async function getReport(actor: Actor, id: string) {
  reportId(id); await requireReportAccess(actor);
  const [report] = await rows<StoredReport>(getDb(), sql`select ${reportColumns} from prayer_app.pastoral_reports p join prayer_app.pastoral_requests r on r.id=p.request_id where p.id=${id} and (p.author_user_id=${actor.id} or (${actor.role === "admin"} and p.submitted_at is not null))`);
  if (!report) throw new ReportError("REPORT_NOT_FOUND", 404);
  // Keep credential-independent data and opaque IDs only; fingerprint is not a public API field.
  const { fingerprint: _fingerprint, ...result } = report; void _fingerprint;
  return { ...result, periodLabel: periodLabel(report) };
}
export async function listReports(actor: Actor, page: number, admin = false, requestId?: string | null) {
  if (admin) requireReportAdmin(actor); else await requireReportAccess(actor);
  int(page, 1, 100000); if (requestId) reportId(requestId);
  const filter = sql`p.submitted_at is not null and ${admin ? sql`true` : sql`p.author_user_id=${actor.id}`} and ${requestId ? sql`p.request_id=${requestId}` : sql`true`}`;
  const [reports, count] = await Promise.all([
    rows<StoredSummary>(getDb(), sql`select p.id,p.request_id as "requestId",p.sam_id as "samId",p.sam_name as "samName",p.village,p.leader_name as "leaderName",p.submitted_by as "submittedBy",p.method,to_char(p.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "submittedAt",r.year,r.month from prayer_app.pastoral_reports p join prayer_app.pastoral_requests r on r.id=p.request_id where ${filter} order by p.submitted_at desc,p.id desc limit 20 offset ${(page - 1) * 20}`),
    rows<{ count: number }>(getDb(), sql`select count(*)::int as count from prayer_app.pastoral_reports p where ${filter}`),
  ]);
  return { reports: reports.map(r => ({ ...r, periodLabel: periodLabel(r) })), total: count[0].count, page };
}
export async function getReportChunk(actor: Actor, id: string, slot: number, index: number) {
  int(slot, 0, 1); int(index, 0, 11);
  const report = await getReport(actor, id); const file = report.files[slot];
  if (!file) throw new ReportError("FILE_NOT_FOUND", 404);
  const expected = chunkSize(file.size, index);
  const [chunk] = await rows<{ data: Buffer }>(getDb(), sql`select data from prayer_app.pastoral_report_chunks where report_id=${id} and slot=${slot} and chunk_index=${index}`);
  if (!chunk || chunk.data.length !== expected) throw new ReportError("FILE_INTEGRITY_FAILED", 409);
  return chunk.data;
}
export async function getReportImage(actor: Actor, id: string, slot: number) {
  int(slot, 0, 1);
  const report = await getReport(actor, id);
  if (!report.files[slot] || !photoName(report.files[slot].name)) throw new ReportError("UNSUPPORTED_IMAGE", 415);
  return rasterPreview(await readFile(getDb(), { ...report, fingerprint: "" }, slot));
}
export async function getReportText(actor: Actor, id: string) {
  const report = await getReport(actor, id);
  return { text: "\uFEFF" + reportText(report), filename: `목양지_${report.samName}_${report.writtenDate}.txt` };
}
