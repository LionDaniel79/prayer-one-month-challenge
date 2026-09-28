import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { createPrayerRequest } from "../../../src/features/prayer-requests/service";
import { DomainError } from "../../../src/lib/http";

const PrayerRequestInput = z.object({
  content: z.string().trim().min(1).max(10000),
});

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = PrayerRequestInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const id = await createPrayerRequest(user.id, parsed.data.content);
    return NextResponse.json({ status: "ok", id }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
