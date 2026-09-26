import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getMemberDashboard, toggleCheckin } from "../../../src/features/checkins/service";
import { DomainError } from "../../../src/lib/http";

const ToggleSchema = z.object({
  prayerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ dashboard: await getMemberDashboard(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = ToggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });

  try {
    const state = await toggleCheckin({
      userId: user.id,
      prayerDate: parsed.data.prayerDate,
    });
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
