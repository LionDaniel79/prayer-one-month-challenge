import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { BookingPeriodInput, getBookingPeriod, saveBookingPeriod } from "../../../../../src/features/visits/booking-period";
import { DomainError } from "../../../../../src/lib/http";

function errorResponse(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json({ code: error.code }, { status: error.status });
  return NextResponse.json({ code: "BOOKING_PERIOD_UNAVAILABLE" }, { status: 503 });
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({ period: await getBookingPeriod() });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = BookingPeriodInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_BOOKING_PERIOD" }, { status: 400 });
    await saveBookingPeriod(parsed.data);
    return NextResponse.json({ period: parsed.data });
  } catch (error) { return errorResponse(error); }
}
