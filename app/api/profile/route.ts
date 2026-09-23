import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getProfile } from "../../../src/features/profile/service";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PATCH() {
  return NextResponse.json({ code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
