import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { getAdminSams, requireAdmin, upsertSam } from "../../../../src/features/admin/service";
import { DomainError } from "../../../../src/lib/http";

const SamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  leaderName: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
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
    return NextResponse.json({ sams: await getAdminSams() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = SamSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    const id = await upsertSam(parsed.data);
    return NextResponse.json({ status: "ok", id });
  } catch (error) {
    return errorResponse(error);
  }
}
