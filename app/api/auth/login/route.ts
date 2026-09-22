import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "../../../../src/features/auth/rate-limit";
import {
  authenticateCredentials,
  credentialExists,
  dbAuthRepository,
} from "../../../../src/features/auth/service";
import {
  createSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../src/features/auth/session";

const LoginSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().min(9).max(30),
});

function requestIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  const { name, phone } = parsed.data;
  const ip = requestIp(request);
  if (await isLoginBlocked(name, ip)) {
    return NextResponse.json(
      { code: "TOO_MANY_ATTEMPTS", message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const exists = await credentialExists(name, phone);
  if (!exists) {
    const failure = await recordLoginFailure(name, ip);
    if (failure.blockedUntil) {
      return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    return NextResponse.json({ code: "REGISTRATION_REQUIRED" }, { status: 404 });
  }

  const user = await authenticateCredentials(dbAuthRepository, name, phone);
  if (!user) {
    const failure = await recordLoginFailure(name, ip);
    if (failure.blockedUntil) {
      return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    return NextResponse.json(
      { code: "INVALID_CREDENTIALS", message: "아이디 또는 비밀번호를 확인해 주세요." },
      { status: 401 },
    );
  }

  await clearLoginFailures(name, ip);
  const session = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  return NextResponse.json({ status: "ok" });
}
