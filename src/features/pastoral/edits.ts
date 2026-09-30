import { createHash } from "node:crypto";
import { getDb, rows, sql, type Executor } from "./db";
import { requireReportAccess, requireReportAdmin } from "./access";
import { lockedReport, readFile, type StoredReport } from "./reports";
import { rasterPreview } from "./images";
import { assertReportMutation, CHUNK_LIMIT, chunkSize, int, parseFiles, parseReportEdit, reportId, ReportError, type Actor, type Attachment, type ReportEdit } from "./policy";

type StoredEdit = { id: string; actorId: string; payload: ReportEdit; applied: boolean; expired: boolean };
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
async function access(actor: Actor, admin: boolean, db?: Executor) {
  if (admin) requireReportAdmin(actor); else await requireReportAccess(actor, db);
}
async function editFor(db: Executor, actor: Actor, original: StoredReport, id: string, admin: boolean, allowExpired = false) {
  assertReportMutation(actor, original, admin);
  const [edit] = await rows<StoredEdit>(db, sql`select id,actor_id as "actorId",payload,(applied_at is not null) as applied,(created_at < now()-interval '24 hours') as expired from prayer_app.pastoral_report_edits where id=${id} and report_id=${original.id} for update`);
  if (!edit || edit.actorId !== actor.id) throw new ReportError("EDIT_NOT_FOUND", 404);
  if (!allowExpired && !edit.applied && edit.expired) throw new ReportError("DRAFT_EXPIRED", 409);
  return edit;
}
function validateVersion(report: StoredReport, version: number) {
  if (report.version !== version) throw new ReportError("REPORT_CHANGED", 409);
}
function combinedFiles(report: StoredReport, input: ReportEdit): Attachment[] {
  const retained = input.keepSlots.map(slot => {
    const file = report.files[slot];
    if (!file) throw new ReportError("FILE_NOT_FOUND", 404);
    return file;
  });
  return parseFiles([...retained, ...input.files], input.method);
}
export async function beginReportEdit(actor: Actor, id: string, value: unknown, admin = false) {
  reportId(id); const input = parseReportEdit(value); const fingerprint = hash(JSON.stringify(input));
  return getDb().transaction(async tx => {
    await tx.execute(sql`select id from prayer_app.users where id=${actor.id} for update`);
    await access(actor, admin, tx);
    const report = await lockedReport(tx, id); assertReportMutation(actor, report, admin);
    const [existing] = await rows<{ actorId: string; reportId: string; fingerprint: string; applied: boolean }>(tx, sql`select actor_id as "actorId",report_id as "reportId",fingerprint,(applied_at is not null) as applied from prayer_app.pastoral_report_edits where id=${input.id}`);
    if (existing) {
      if (existing.actorId !== actor.id || existing.reportId !== id || existing.fingerprint !== fingerprint) throw new ReportError("ID_CONFLICT", 409);
      return { id: input.id, applied: existing.applied };
    }
    validateVersion(report, input.expectedVersion); combinedFiles(report, input);
    await tx.execute(sql`delete from prayer_app.pastoral_report_edits where actor_id=${actor.id} and created_at<now()-interval '24 hours' and applied_at is null`);
    const [quota] = await rows<{ count: number }>(tx, sql`select count(*)::int as count from prayer_app.pastoral_report_edits where actor_id=${actor.id} and applied_at is null`);
    if (quota.count >= 3) throw new ReportError("DRAFT_LIMIT", 429);
    await tx.execute(sql`insert into prayer_app.pastoral_report_edits(id,report_id,actor_id,expected_version,payload,fingerprint) values(${input.id},${id},${actor.id},${input.expectedVersion},${JSON.stringify(input)}::jsonb,${fingerprint})`);
    return { id: input.id, applied: false };
  });
}
export async function putEditChunk(actor: Actor, id: string, editId: string, slot: number, index: number, bytes: Buffer, admin = false) {
  reportId(id); reportId(editId); int(slot, 0, 1); int(index, 0, 11);
  await getDb().transaction(async tx => {
    await access(actor, admin, tx); const report = await lockedReport(tx, id);
    const edit = await editFor(tx, actor, report, editId, admin);
    if (edit.applied) throw new ReportError("EDIT_APPLIED", 409);
    validateVersion(report, edit.payload.expectedVersion);
    const file = edit.payload.files[slot];
    if (!file || bytes.length !== chunkSize(file.size, index)) throw new ReportError("INVALID_CHUNK");
    await tx.execute(sql`insert into prayer_app.pastoral_edit_chunks(edit_id,slot,chunk_index,data) values(${editId},${slot},${index},${bytes}) on conflict(edit_id,slot,chunk_index) do update set data=excluded.data`);
  });
}
async function stagedFile(db: Executor, edit: StoredEdit, slot: number): Promise<Buffer> {
  const file = edit.payload.files[slot];
  const chunks = await rows<{ index: number; data: Buffer }>(db, sql`select chunk_index as index,data from prayer_app.pastoral_edit_chunks where edit_id=${edit.id} and slot=${slot} order by chunk_index`);
  if (chunks.length !== Math.ceil(file.size / CHUNK_LIMIT)) throw new ReportError("UPLOAD_INCOMPLETE", 409);
  for (let i=0;i<chunks.length;i++) if (chunks[i].index!==i || chunks[i].data.length!==chunkSize(file.size,i)) throw new ReportError("FILE_INTEGRITY_FAILED",409);
  const bytes=Buffer.concat(chunks.map(c=>c.data));
  if (bytes.length!==file.size || hash(bytes)!==file.sha256) throw new ReportError("FILE_INTEGRITY_FAILED",409);
  return bytes;
}
export async function publishReportEdit(actor: Actor, id: string, editId: string, admin = false) {
  reportId(id); reportId(editId);
  await getDb().transaction(async tx => {
    await access(actor, admin, tx); const report=await lockedReport(tx,id);
    const edit=await editFor(tx,actor,report,editId,admin);
    if(edit.applied)return; // A lost response must not apply this revision again.
    const input=edit.payload; validateVersion(report,input.expectedVersion);
    const files=combinedFiles(report,input); const bytes:Buffer[]=[];
    for(const slot of input.keepSlots) bytes.push(await readFile(tx,report,slot));
    for(let slot=0;slot<input.files.length;slot++) bytes.push(await stagedFile(tx,edit,slot));
    if(input.method==='photo')for(const data of bytes)await rasterPreview(data);
    // Removed form fields remain in existing stored JSON; no silent historical data destruction.
    const form=input.form ? {...(report.form??{}),...input.form} : null;
    await tx.execute(sql`delete from prayer_app.pastoral_report_chunks where report_id=${id}`);
    for(let slot=0;slot<bytes.length;slot++)for(let start=0,index=0;start<bytes[slot].length;start+=CHUNK_LIMIT,index++) {
      await tx.execute(sql`insert into prayer_app.pastoral_report_chunks(report_id,slot,chunk_index,data) values(${id},${slot},${index},${bytes[slot].subarray(start,start+CHUNK_LIMIT)})`);
    }
    await tx.execute(sql`update prayer_app.pastoral_reports set written_date=${input.writtenDate},method=${input.method},form=${form?JSON.stringify(form):null}::jsonb,files=${JSON.stringify(files)}::jsonb,version=version+1,updated_at=now(),updated_by=${actor.id} where id=${id}`);
    await tx.execute(sql`update prayer_app.pastoral_report_edits set applied_at=now() where id=${editId}`);
    await tx.execute(sql`delete from prayer_app.pastoral_edit_chunks where edit_id=${editId}`);
  });
  return {id,applied:true};
}
export async function cancelReportEdit(actor:Actor,id:string,editId:string,admin=false) {
  reportId(id);reportId(editId);
  await getDb().transaction(async tx=>{
    await access(actor,admin,tx);const report=await lockedReport(tx,id);
    const edit=await editFor(tx,actor,report,editId,admin,true);
    if(edit.applied)throw new ReportError('EDIT_APPLIED',409);
    await tx.execute(sql`delete from prayer_app.pastoral_report_edits where id=${editId}`);
  });
}
export async function deleteSubmittedReport(actor:Actor,id:string,expectedVersion:number,admin=false) {
  reportId(id);int(expectedVersion,0,2147483646);
  await getDb().transaction(async tx=>{
    await access(actor,admin,tx);
    const [exists]=await rows<{id:string}>(tx,sql`select id from prayer_app.pastoral_reports where id=${id} for update`);
    if(!exists)return; // Idempotent deletion; never delete a different revision by stale UI.
    const report=await lockedReport(tx,id);assertReportMutation(actor,report,admin);validateVersion(report,expectedVersion);
    await tx.execute(sql`delete from prayer_app.pastoral_reports where id=${id} and submitted_at is not null`);
  });
}
