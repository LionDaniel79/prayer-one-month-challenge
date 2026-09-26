import { NextRequest, NextResponse } from "next/server";
import { searchSams } from "../../../src/features/sams/service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.slice(0, 80) ?? "";
  return NextResponse.json({ sams: await searchSams(query) });
}
