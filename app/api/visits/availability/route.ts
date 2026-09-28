import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { DomainError } from "../../../../src/lib/http";
import { getMonthAvailability } from "../../../../src/features/visits/service";
import { getSelectedCalendarProvider } from "../../../../src/features/visits/provider-factory";

const MonthQuery = z.string().regex(/^\d{4}-\d{2}$/);

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MonthQuery.safeParse(month).success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const provider = await getSelectedCalendarProvider();
    const dates = await getMonthAvailability(month, provider);
    return NextResponse.json({ dates });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
