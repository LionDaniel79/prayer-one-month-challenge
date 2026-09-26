import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import {
  blockVisitDate,
  listVisitBlockedDates,
  unblockVisitDate,
} from "../../../../../src/features/visits/admin-service";
import { DomainError } from "../../../../../src/lib/http";

const DateInput = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).nullable().optional(),
});

const DateOnly = DateInput.pick({ visitDate: true });

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
    return NextResponse.json({ dates: await listVisitBlockedDates() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);
    const parsed = DateInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    await blockVisitDate({
      visitDate: parsed.data.visitDate,
      reason: parsed.data.reason ?? null,
      adminUserId: user.id,
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = DateOnly.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    await unblockVisitDate(parsed.data.visitDate);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
