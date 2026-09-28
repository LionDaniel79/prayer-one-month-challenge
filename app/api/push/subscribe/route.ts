import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  removePushSubscription,
  savePushSubscription,
} from "../../../../src/features/push/service";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const DeleteSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = SubscriptionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  await savePushSubscription(
    user.id,
    parsed.data,
    request.headers.get("user-agent"),
  );
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = DeleteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  await removePushSubscription(user.id, parsed.data.endpoint);
  return NextResponse.json({ status: "ok" });
}
