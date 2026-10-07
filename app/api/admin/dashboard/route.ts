import { NextResponse } from "next/server";
import { getAdminHubDashboard } from "../../../../src/features/admin/hub-service";
import { parseActivityPage } from "../../../../src/features/admin/metrics-policy";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { DomainError } from "../../../../src/lib/http";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export async function GET(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    let page: number;
    try { page = parseActivityPage(new URL(request.url).searchParams.get("page")); }
    catch { return NextResponse.json({ code: "INVALID_PAGE" }, { status: 400, headers }); }
    return NextResponse.json(await getAdminHubDashboard(new Date(), page), { headers });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ code: error.code }, { status: error.status, headers });
    return NextResponse.json({ code: "ADMIN_HUB_LOAD_FAILED" }, { status: 500, headers });
  }
}
