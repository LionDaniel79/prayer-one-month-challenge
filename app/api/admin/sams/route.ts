import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { listSamLeadersForAdmin, saveSamLeader } from "../../../../src/features/sams/admin-service";
import { DomainError } from "../../../../src/lib/http";

const SamLeaderInput = z.object({
  name: z.string().trim().min(1).max(100),
  leaderName: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
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
    const parsed = SamLeaderInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    await saveSamLeader(parsed.data);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
