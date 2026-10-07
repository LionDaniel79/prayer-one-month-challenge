import { getDb, sql } from "./db";
import { requireReportAdmin } from "./access";
import { lockedReport } from "./reports";
import { int, reportId, ReportError, type Actor } from "./policy";

/** Acknowledge exactly the version displayed, never a newer concurrent revision.
 * Explicit admin POST only: list/detail GETs, previews and file downloads have no side effects.
 */
export async function markReportReviewed(actor: Actor, id: string, expectedVersion: number) {
  requireReportAdmin(actor);
  reportId(id); int(expectedVersion,0,2147483646);
  return getDb().transaction(async tx => {
    const report = await lockedReport(tx,id);
    if (!report.submittedAt) throw new ReportError("REPORT_NOT_FINALIZED",409);
    if (report.version !== expectedVersion) throw new ReportError("REPORT_CHANGED",409);
    if (report.reviewedVersion < report.version) {
      await tx.execute(sql`update prayer_app.pastoral_reports
        set reviewed_version=version, reviewed_at=now(), reviewed_by=${actor.id}
        where id=${id} and version=${expectedVersion} and reviewed_version < version`);
    }
    return { id, version: report.version, isReviewed: true };
  });
}
