import { revisionResponse } from "../../../../src/features/pastoral/edit-http";
import { NextResponse } from "next/server";
import { pastoralStatus } from "../../../../src/features/pastoral/schedules";
import { beginReport, cancelDraft, getReport, getReportChunk, getReportImage, getReportText, listReports, publishReport, putReportChunk } from "../../../../src/features/pastoral/reports";
import { binary, boundedBytes, boundedJson, errorResponse, json, privateHeaders, sameOrigin, sessionActor } from "../../../../src/features/pastoral/http";
import { requireReportAccess } from "../../../../src/features/pastoral/access";
import { CHUNK_LIMIT, ReportError } from "../../../../src/features/pastoral/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await sessionActor(); const path = (await context.params).path; const url = new URL(request.url);
    if (path.length === 1 && path[0] === "status") return json(await pastoralStatus(actor));
    await requireReportAccess(actor);
    if (path.length === 1 && path[0] === "reports") return json(await listReports(actor, Number(url.searchParams.get("page") ?? 1)));
    if (path[0] !== "reports") throw new ReportError("NOT_FOUND", 404);
    if (path.length === 2) return json({ report: await getReport(actor, path[1]) });
    if (path.length === 3 && path[2] === "txt") {
      const result = await getReportText(actor, path[1]);
      return new NextResponse(result.text, { headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="pastoral-report.txt"; filename*=UTF-8''${encodeURIComponent(result.filename)}` } });
    }
    if (path.length === 5 && path[2] === "files" && path[4] === "image") return binary(await getReportImage(actor, path[1], Number(path[3])), "image/webp");
    if (path.length === 6 && path[2] === "files" && path[4] === "chunks") return binary(await getReportChunk(actor, path[1], Number(path[3]), Number(path[5])));
    throw new ReportError("NOT_FOUND", 404);
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await sessionActor(); sameOrigin(request); await requireReportAccess(actor);
    const path = (await context.params).path;
    const revision = await revisionResponse(request,path,actor,false); if(revision)return revision;
    if (path.length === 1 && path[0] === "reports") return json(await beginReport(actor, await boundedJson(request)), 201);
    if (path.length === 3 && path[0] === "reports" && path[2] === "publish") return json(await publishReport(actor, path[1]));
    throw new ReportError("NOT_FOUND", 404);
  } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await sessionActor(); sameOrigin(request); await requireReportAccess(actor);
    const path = (await context.params).path;
    const revision = await revisionResponse(request,path,actor,false); if(revision)return revision;
    if (path.length !== 6 || path[0] !== "reports" || path[2] !== "files" || path[4] !== "chunks") throw new ReportError("NOT_FOUND", 404);
    if (request.headers.get("content-type") !== "application/octet-stream") throw new ReportError("INVALID_CONTENT_TYPE", 415);
    await putReportChunk(actor, path[1], Number(path[3]), Number(path[5]), await boundedBytes(request, CHUNK_LIMIT));
    return json({ status: "ok" });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const actor = await sessionActor(); sameOrigin(request);
    const path = (await context.params).path;
    const revision = await revisionResponse(request,path,actor,false); if(revision)return revision;
    if (path.length !== 2 || path[0] !== "reports") throw new ReportError("NOT_FOUND", 404);
    await cancelDraft(actor, path[1]); return json({ status: "ok" });
  } catch (error) { return errorResponse(error); }
}
