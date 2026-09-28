import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  getPublishedNoticeForUser,
  markNoticeRead,
} from "../../../../src/features/notices/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const notice = await getPublishedNoticeForUser(id, user.id);
  if (!notice) {
    return NextResponse.json({ code: "NOTICE_NOT_FOUND" }, { status: 404 });
  }

  await markNoticeRead(id, user.id);
  return NextResponse.json({
    notice: { ...notice, isUnread: false },
  });
}
