import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { registerMember } from "../../../../src/features/auth/service";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../src/features/auth/session";

const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().min(9).max(30),
  samId: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = RegisterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const result = await registerMember(parsed.data);
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "INVALID_SAM") {
      return NextResponse.json({ code: "INVALID_SAM" }, { status: 400 });
    }
    if (message === "ACCOUNT_EXISTS") {
      return NextResponse.json({ code: "ACCOUNT_EXISTS" }, { status: 409 });
    }
    throw error;
  }
}
