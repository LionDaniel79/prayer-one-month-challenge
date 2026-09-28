import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  listPrayerRequestsForAdmin,
  parsePrayerRequestStatus,
} from "../../../../src/features/prayer-requests/service";
import { DomainError } from "../../../../src/lib/http";

export async function GET(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus ? parsePrayerRequestStatus(rawStatus) : undefined;

    return NextResponse.json({
      requests: await listPrayerRequestsForAdmin({ status }),
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
