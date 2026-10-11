import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { createPrayerRequest, listOwnPrayerRequests } from "../../../src/features/prayer-requests/service";
import { json, prayerActor, prayerError } from "../../../src/features/prayer-requests/http";
import { DomainError } from "../../../src/lib/http";
import { scheduleEmailDelivery } from "../../../src/features/email/wakeup";

const PrayerRequestInput = z.object({
  content: z.string().trim().min(1).max(10000),
});

export async function GET(request: Request) {
  try {
    const actor = await prayerActor();
    const page = z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get("page") ?? 0);
    if (!page.success) return json({ code: "INVALID_INPUT" }, 400);
    return json(await listOwnPrayerRequests(actor.id, page.data));
  } catch (error) { return prayerError(error); }
}

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
    scheduleEmailDelivery(request);
    return NextResponse.json({ status: "ok", id }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
