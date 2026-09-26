import { NextResponse } from "next/server";
import { z } from "zod";
import { resetRosterPassword } from "../../../../../src/features/admin/roster-service";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { DomainError } from "../../../../../src/lib/http";

const PasswordResetSchema = z.discriminatedUnion("mode", [
  z.object({
    id: z.string().uuid(),
    mode: z.literal("custom"),
    password: z.string().min(1),
  }),
  z.object({
    id: z.string().uuid(),
    mode: z.literal("initial"),
  }),
]);

export async function POST(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = PasswordResetSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }

    const mode = await resetRosterPassword(
      parsed.data.id,
      parsed.data.mode === "custom" ? parsed.data.password : null,
    );
    return NextResponse.json({ status: "ok", mode });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
