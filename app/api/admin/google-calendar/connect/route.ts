import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { createGoogleOAuthClient } from "../../../../../src/features/google-calendar/client";
import {
  googleAuthorizationUrlOptions,
  newGoogleOAuthState,
} from "../../../../../src/features/google-calendar/oauth";
import { getEnv } from "../../../../../src/lib/env";

export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  requireAdmin(user);

  try {
    const redirectUri =
      request.nextUrl.origin + "/api/admin/google-calendar/callback";
    const oauth = createGoogleOAuthClient(redirectUri);
    const state = newGoogleOAuthState();
    const url = oauth.generateAuthUrl(googleAuthorizationUrlOptions(state));

    const response = NextResponse.redirect(url);
    response.cookies.set("google_calendar_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MISSING_GOOGLE_CALENDAR_CONFIG"
    ) {
      return NextResponse.json(
        { code: "GOOGLE_CALENDAR_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    throw error;
  }
}
