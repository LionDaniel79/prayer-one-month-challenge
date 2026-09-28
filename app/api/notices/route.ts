import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { listPublishedNotices } from "../../../src/features/notices/service";

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json({
    notices: await listPublishedNotices(user.id),
  });
}
