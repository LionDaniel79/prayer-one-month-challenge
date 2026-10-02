import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { getPrayerMenuSettings, savePrayerMenuSettings } from "../../../../../src/features/prayer-menu/service";
import { DomainError } from "../../../../../src/lib/http";

export const dynamic = "force-dynamic";
const Input = z.object({ enabled: z.boolean() }).strict();
const headers = { "Cache-Control": "private, no-store, max-age=0" };

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status, headers });
  }
  throw error;
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json(await getPrayerMenuSettings(), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new DomainError("FORBIDDEN", 403);
    }
    const parsed = Input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });
    return NextResponse.json(await savePrayerMenuSettings(parsed.data.enabled), { headers });
  } catch (error) { return errorResponse(error); }
}
