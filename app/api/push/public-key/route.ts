import { NextResponse } from "next/server";
import { getEnv } from "../../../../src/lib/env";

export async function GET() {
  const publicKey = getEnv().WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { code: "PUSH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}
