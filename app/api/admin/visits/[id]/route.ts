import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import {
  dbVisitAdminRepository,
  updateVisitDetails,
} from "../../../../../src/features/visits/admin-service";
import { getSelectedCalendarProvider } from "../../../../../src/features/visits/provider-factory";
import { DomainError } from "../../../../../src/lib/http";

const VisitPatch = z.object({
  visitType: z.enum(["personal", "sam"]).optional(),
  attendees: z.string().trim().min(1).max(3000).optional(),
  location: z.string().trim().min(1).max(500).optional(),
  preferredTime: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().min(1).max(10000).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "EMPTY_PATCH",
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
    const visit = await dbVisitAdminRepository.getById(id);
    if (!visit) {
      return NextResponse.json({ code: "VISIT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ visit });
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
    const parsed = VisitPatch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    const { id } = await context.params;
    const provider = await getSelectedCalendarProvider();
    await updateVisitDetails(id, parsed.data, provider);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}
