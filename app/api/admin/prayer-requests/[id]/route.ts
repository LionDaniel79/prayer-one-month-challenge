import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import {
  getPrayerRequestForAdmin,
  updatePrayerRequestStatus,
} from "../../../../../src/features/prayer-requests/service";
import { DomainError } from "../../../../../src/lib/http";

const StatusPatch = z.object({
  status: z.enum(["received", "praying", "completed"]),
});

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const { id } = await context.params;
    const request = await getPrayerRequestForAdmin(id);
    if (!request) {
      return NextResponse.json(
        { code: "PRAYER_REQUEST_NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.json({ request });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = StatusPatch.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }

    const { id } = await context.params;
    await updatePrayerRequestStatus(id, parsed.data.status);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
