import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { listVisitsForAdmin } from "../../../../src/features/visits/admin-service";
import { DomainError } from "../../../../src/lib/http";

const Status = z.enum(["requested", "confirmed", "completed", "cancelled"]);
const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function GET(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const rawFrom = url.searchParams.get("from");
    const rawTo = url.searchParams.get("to");

    const status = rawStatus ? Status.safeParse(rawStatus) : null;
    const from = rawFrom ? DateKey.safeParse(rawFrom) : null;
    const to = rawTo ? DateKey.safeParse(rawTo) : null;
    if (
      (status && !status.success) ||
      (from && !from.success) ||
      (to && !to.success)
    ) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }

    const visits = await listVisitsForAdmin({
      status: status?.data,
      from: from?.data,
      to: to?.data,
    });
    return NextResponse.json({ visits });
  } catch (error) {
    return errorResponse(error);
  }
}
