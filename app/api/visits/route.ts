import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { DomainError } from "../../../src/lib/http";
import { getSelectedCalendarProvider } from "../../../src/features/visits/provider-factory";
import { submitVisitRequest } from "../../../src/features/visits/service";

const VisitInput = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitType: z.enum(["personal", "sam"]),
  attendees: z.string().trim().min(1).max(3000),
  location: z.string().trim().min(1).max(500),
  preferredTime: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(10000),
});

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = VisitInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const provider = await getSelectedCalendarProvider();
    const result = await submitVisitRequest(
      {
        requesterUserId: user.id,
        ...parsed.data,
      },
      provider,
    );
    return NextResponse.json({ status: "ok", ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
