import { listVillageLeaders, saveVillageLeader, deleteVillageLeader } from "../../../../../src/features/pastoral/villages";
import { requireAdminActor, boundedJson, errorResponse, json, sameOrigin } from "../../../../../src/features/pastoral/http";
import { object, reportId } from "../../../../../src/features/pastoral/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return json({ rows: await listVillageLeaders(await requireAdminActor()) }); }
  catch (e) { return errorResponse(e); }
}
export async function PUT(request: Request) {
  try { const actor = await requireAdminActor(); sameOrigin(request); await saveVillageLeader(actor, await boundedJson(request)); return json({ status: "ok" }); }
  catch (e) { return errorResponse(e); }
}
export async function DELETE(request: Request) {
  try { const actor = await requireAdminActor(); sameOrigin(request); await deleteVillageLeader(actor, reportId(object(await boundedJson(request)).id)); return json({ status: "ok" }); }
  catch (e) { return errorResponse(e); }
}
