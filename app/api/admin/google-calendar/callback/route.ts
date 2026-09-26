import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { createGoogleOAuthClient } from "../../../../../src/features/google-calendar/client";
import { encryptGoogleRefreshToken } from "../../../../../src/features/google-calendar/crypto";
import { assertGoogleOAuthState } from "../../../../../src/features/google-calendar/oauth";
import { saveGoogleCalendarConnection } from "../../../../../src/features/google-calendar/repository";
import { DomainError } from "../../../../../src/lib/http";

function clearState(response: NextResponse) {
  response.cookies.delete("google_calendar_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentSessionUser();
    requireAdmin(user);

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const expectedState = request.cookies.get(
      "google_calendar_oauth_state",
    )?.value;

    assertGoogleOAuthState(state, expectedState);
    if (!code) throw new DomainError("GOOGLE_OAUTH_CODE_MISSING", 400);

    const redirectUri =
      request.nextUrl.origin + "/api/admin/google-calendar/callback";
    const oauth = createGoogleOAuthClient(redirectUri);
    const { tokens } = await oauth.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      throw new DomainError("GOOGLE_REFRESH_TOKEN_MISSING", 400);
    }

    let accountEmail: string | null = null;
    if (tokens.access_token) {
      try {
        const info = await oauth.getTokenInfo(tokens.access_token);
        accountEmail = info.email ?? null;
      } catch {
        accountEmail = null;
      }
    }

    await saveGoogleCalendarConnection({
      connectedByUserId: user.id,
      googleAccountEmail: accountEmail,
      refreshTokenCiphertext: encryptGoogleRefreshToken(refreshToken),
    });

    return clearState(
      NextResponse.redirect(
        new URL("/admin/settings?calendar=connected", request.url),
      ),
    );
  } catch (error) {
    const status =
      error instanceof DomainError
        ? error.status
        : error instanceof Error &&
            error.message === "MISSING_GOOGLE_CALENDAR_CONFIG"
          ? 503
          : 500;
    const code =
      error instanceof DomainError
        ? error.code
        : status === 503
          ? "GOOGLE_CALENDAR_NOT_CONFIGURED"
          : "GOOGLE_OAUTH_FAILED";

    return clearState(NextResponse.json({ code }, { status }));
  }
}
