import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { deleteSamLeaders, listSamLeadersForAdmin, saveSamLeader } from "../../../../src/features/sams/admin-service";
import { sameOrigin } from "../../../../src/features/pastoral/http";
import { ReportError } from "../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../src/lib/http";

const SamLeaderInput = z.object({
  name: z.string().trim().min(1).max(100),
  leaderName: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
  leaderRosterId:z.string().uuid().optional(),
});

const SamLeaderDelete = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

function errorResponse(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({ rows: await listSamLeadersForAdmin() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    sameOrigin(request);
    const parsed = SamLeaderInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    await saveSamLeader(parsed.data);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    sameOrigin(request);
    const parsed = SamLeaderDelete.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    const deleted = await deleteSamLeaders([...new Set(parsed.data.ids)]);
    return NextResponse.json({ status: "ok", deleted });
  } catch (error) {
    if (error instanceof DomainError || error instanceof ReportError) return errorResponse(error);
    return NextResponse.json({ code: "SAM_LEADER_DELETE_FAILED" }, { status: 503 });
  }
}
