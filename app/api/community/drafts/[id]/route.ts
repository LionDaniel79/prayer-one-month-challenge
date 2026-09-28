import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { discardDraft } from "../../../../../src/features/community/drafts";
import { assertSameOrigin } from "../../../../../src/features/community/http";
import { CommunityError, uuid } from "../../../../../src/features/community/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
    assertSameOrigin(request);
    const { id } = await context.params;
    return NextResponse.json(await discardDraft(user, uuid(id)), { headers });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json({ code: error.code }, { status: error.status, headers });
    }
    console.error("COMMUNITY_DRAFT_CANCEL_FAILED", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ code: "COMMUNITY_UNAVAILABLE" }, { status: 500, headers });
  }
}
