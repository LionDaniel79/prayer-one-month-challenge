import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getProfile, updateMySam } from "../../../src/features/profile/service";

const UpdateSchema = z.object({ samId: z.string().uuid() });

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  try {
    await updateMySam(user.id, parsed.data.samId);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SAM") {
      return NextResponse.json({ code: "INVALID_SAM" }, { status: 400 });
    }
    throw error;
  }
}
