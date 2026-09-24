import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import {
  changeProfilePassword,
  getProfile,
} from "../../../src/features/profile/service";
import { DomainError } from "../../../src/lib/http";

const PasswordUpdateSchema = z.object({
  password: z.string().min(1),
});

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const parsed = PasswordUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    await changeProfilePassword(user.id, parsed.data.password);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
