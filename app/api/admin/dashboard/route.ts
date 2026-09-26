import { NextResponse } from "next/server";
import { getAdminHubDashboard } from "../../../../src/features/admin/hub-service";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { DomainError } from "../../../../src/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json(await getAdminHubDashboard());
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
