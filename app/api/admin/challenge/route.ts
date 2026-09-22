import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  getAdminChallenge,
  requireAdmin,
  updateChallenge,
} from "../../../../src/features/admin/service";
import { DomainError } from "../../../../src/lib/http";

const ChallengeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    return NextResponse.json({ challenges: await getAdminChallenge() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    const parsed = ChallengeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    const id = await updateChallenge(parsed.data);
    return NextResponse.json({ status: "ok", id });
  } catch (error) {
    return errorResponse(error);
  }
}
