import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  refreshSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../../src/features/auth/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ status: "no-session" }, { status: 401 });

  const rolled = await refreshSession(token);
  if (rolled) store.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return NextResponse.json({ status: "ok", rolled });
}
