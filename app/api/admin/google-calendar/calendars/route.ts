import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { listConnectedCalendars } from "../../../../../src/features/google-calendar/client";
import { DomainError } from "../../../../../src/lib/http";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    return NextResponse.json({
      calendars: await listConnectedCalendars(),
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
