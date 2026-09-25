import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { createGoogleOAuthClient } from "../../../../../src/features/google-calendar/client";
import { decryptGoogleRefreshToken } from "../../../../../src/features/google-calendar/crypto";
import {
  deleteGoogleCalendarConnection,
  getGoogleCalendarConnection,
} from "../../../../../src/features/google-calendar/repository";

export async function DELETE() {
  const user = await getCurrentSessionUser();
  requireAdmin(user);

  const current = await getGoogleCalendarConnection();
  if (current) {
    try {
      const oauth = createGoogleOAuthClient();
      await oauth.revokeToken(
        decryptGoogleRefreshToken(current.refreshTokenCiphertext),
      );
    } catch {
      // Remote revocation is best-effort; local removal must still succeed.
    }
  }

  await deleteGoogleCalendarConnection();
  return NextResponse.json({ status: "ok" });
}
