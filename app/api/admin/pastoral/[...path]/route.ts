import { revisionResponse } from "../../../../../src/features/pastoral/edit-http";
import { requireReportAdmin } from "../../../../../src/features/pastoral/access";
import { getSchedule, requestOverview, saveSchedule } from "../../../../../src/features/pastoral/schedules";
import { listReports } from "../../../../../src/features/pastoral/reports";
import { boundedJson, errorResponse, json, sameOrigin, requireAdminActor } from "../../../../../src/features/pastoral/http";
import { ReportError, seoulToday } from "../../../../../src/features/pastoral/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireAdminActor(); requireReportAdmin(actor);
    const path = (await context.params).path; const url = new URL(request.url);
    if (path.length !== 1) throw new ReportError("NOT_FOUND", 404);
    if (path[0] === "schedule") return json(await getSchedule(actor, Number(url.searchParams.get("year") ?? seoulToday().slice(0, 4))));
    if (path[0] === "overview") return json(await requestOverview(actor, url.searchParams.get("requestId") ?? ""));
    if (path[0] === "reports") return json(await listReports(actor, Number(url.searchParams.get("page") ?? 1), true, url.searchParams.get("requestId")));
    throw new ReportError("NOT_FOUND", 404);
  } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireAdminActor(); requireReportAdmin(actor); sameOrigin(request);
    const path = (await context.params).path;
    const revision=await revisionResponse(request,path,actor,true); if(revision)return revision;
    if (path.length !== 1 || path[0] !== "schedule") throw new ReportError("NOT_FOUND", 404);
    return json(await saveSchedule(actor, await boundedJson(request)));
  } catch (error) { return errorResponse(error); }
}

async function mutateReport(request:Request,context:Context) {
  try {
    const actor=await requireAdminActor();sameOrigin(request);
    const response=await revisionResponse(request,(await context.params).path,actor,true);
    if(response)return response;
    throw new ReportError("NOT_FOUND",404);
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request,context:Context) { return mutateReport(request,context); }
export async function DELETE(request:Request,context:Context) { return mutateReport(request,context); }
