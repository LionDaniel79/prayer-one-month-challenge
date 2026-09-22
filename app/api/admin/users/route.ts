import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  getAdminUsers,
  requireAdmin,
  updateUserAdmin,
} from "../../../../src/features/admin/service";
import { DomainError } from "../../../../src/lib/http";

const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  samId: z.string().uuid().nullable().optional(),
  role: z.enum(["member", "admin"]).optional(),
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
    return NextResponse.json({ users: await getAdminUsers() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = UpdateUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    await updateUserAdmin(parsed.data);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
