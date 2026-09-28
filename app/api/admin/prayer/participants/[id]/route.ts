import { NextResponse } from "next/server";
import { z } from "zod";
import { excludePrayerParticipant } from "../../../../../../src/features/admin/prayer-participants";
import { requireAdmin } from "../../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../../src/features/auth/http-session";
import { DomainError } from "../../../../../../src/lib/http";

const ParticipantId = z.string().uuid();
const ExclusionInput = z.object({ challengeId: z.string().uuid() });

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const id = ParticipantId.safeParse((await params).id);
    const input = ExclusionInput.safeParse(await request.json().catch(() => null));
    if (!id.success || !input.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    await excludePrayerParticipant(id.data, input.data.challengeId);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
