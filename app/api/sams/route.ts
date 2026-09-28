import { NextRequest, NextResponse } from "next/server";
import { searchSams } from "../../../src/features/sams/service";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";

export async function GET(request: NextRequest) {
  if (!await getCurrentSessionUser()) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.get("q")?.slice(0, 80) ?? "";
  return NextResponse.json({ sams: await searchSams(query) });
}
