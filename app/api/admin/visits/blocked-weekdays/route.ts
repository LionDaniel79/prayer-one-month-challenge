import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { todayInSeoul } from "../../../../../src/features/challenge/date";
import {
  listVisitBlockedWeekdays,
  replaceVisitBlockedWeekdays,
} from "../../../../../src/features/visits/admin-service";
import { DomainError } from "../../../../../src/lib/http";

const WeekdaysInput = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
});

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { code: error.code, details: error.message === error.code ? undefined : error.message },
      { status: error.status },
    );
  }
  throw error;
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({ weekdays: await listVisitBlockedWeekdays() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    const parsed = WeekdaysInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success || new Set(parsed.data?.weekdays ?? []).size !== (parsed.data?.weekdays.length ?? 0)) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    await replaceVisitBlockedWeekdays({
      weekdays: parsed.data.weekdays,
      adminUserId: user.id,
      today: todayInSeoul(),
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
