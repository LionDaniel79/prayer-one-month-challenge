import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getPrayerMenuSettings } from "../../../src/features/prayer-menu/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getCurrentSessionUser()) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json(await getPrayerMenuSettings(), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
