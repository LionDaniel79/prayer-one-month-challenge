import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "../../../../src/features/auth/rate-limit";
import { authenticateRosterLogin } from "../../../../src/features/auth/service";
import {
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
      {
        code: "TOO_MANY_ATTEMPTS",
        message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 429 },
    );
  }

  const result = await authenticateRosterLogin(name, phone);
  if (!result) {
    const failure = await recordLoginFailure(name, ip);
    if (failure.blockedUntil) {
      return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    return NextResponse.json(
      {
        code: "ROSTER_MISMATCH",
        message: "등록된 명단과 일치하지 않습니다. 이름과 전화번호를 확인해 주세요.",
      },
      { status: 401 },
    );
  }

  await clearLoginFailures(name, ip);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
  return NextResponse.json({ status: "ok" });
}
