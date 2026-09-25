import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { getGoogleCalendarConnection } from "../../../../../src/features/google-calendar/repository";

export async function GET() {
  const user = await getCurrentSessionUser();
  requireAdmin(user);

  const connection = await getGoogleCalendarConnection();
  return NextResponse.json({
    connected: Boolean(connection),
    accountEmail: connection?.googleAccountEmail ?? null,
    selectedCalendarId: connection?.selectedCalendarId ?? null,
    selectedCalendarName: connection?.selectedCalendarName ?? null,
  });
}
