import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../../src/features/auth/http-session";
import { cancelVisit } from "../../../../../../src/features/visits/admin-service";
import { getSelectedCalendarProvider } from "../../../../../../src/features/visits/provider-factory";
import { DomainError } from "../../../../../../src/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const { id } = await context.params;
    await cancelVisit(id, await getSelectedCalendarProvider());
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
