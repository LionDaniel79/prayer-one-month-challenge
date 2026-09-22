import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  revokeSession,
  SESSION_COOKIE_NAME,
} from "../../../../src/features/auth/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) await revokeSession(token);
  store.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ status: "ok" });
}
