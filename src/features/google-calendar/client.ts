import { google } from "googleapis";
import { DomainError } from "../../lib/http";
import { requireGoogleCalendarConfig } from "../../lib/env";
import { decryptGoogleRefreshToken } from "./crypto";
import { getGoogleCalendarConnection } from "./repository";

export function createGoogleOAuthClient(redirectUri?: string) {
  const config = requireGoogleCalendarConfig();
  const oauth = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    redirectUri,
  );
  // Include token exchange/refresh, which runs before Calendar's own request.
  oauth.transporter.interceptors.request.add({ resolved: async (options) => {
    if (options.url.toString() === oauth.endpoints.oauth2TokenUrl.toString()) {
      options.timeout = 5_000;
      options.retry = false;
    }
    return options;
  } });
  return oauth;
}

let authorized: {
  connectionId: string;
  ciphertext: string;
  oauth: ReturnType<typeof createGoogleOAuthClient>;
} | undefined;

export async function getAuthorizedGoogleCalendarContext() {
  const connection = await getGoogleCalendarConnection();
  if (!connection) {
    authorized = undefined;
    throw new DomainError("CALENDAR_NOT_CONNECTED", 409);
  }

  // Recheck the connection each time so disconnects/reconnections take effect.
  // Reuse only the SDK's expiring access token and in-flight refresh promise.
  if (!authorized || authorized.connectionId !== connection.id ||
      authorized.ciphertext !== connection.refreshTokenCiphertext) {
    const oauth = createGoogleOAuthClient();
    oauth.setCredentials({ refresh_token: decryptGoogleRefreshToken(connection.refreshTokenCiphertext) });
    authorized = { connectionId: connection.id, ciphertext: connection.refreshTokenCiphertext, oauth };
  }
  const { oauth } = authorized;

  return {
    connection,
    oauth,
    calendar: google.calendar({ version: "v3", auth: oauth }),
  };
}

export async function listConnectedCalendars(): Promise<Array<{
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
}>> {
  const { calendar } = await getAuthorizedGoogleCalendarContext();
  const rows: Array<{
    id: string;
    summary: string;
    primary: boolean;
    accessRole: string | null;
  }> = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.calendarList.list({
      pageToken,
      maxResults: 250,
      showHidden: false,
    });

    for (const item of response.data.items ?? []) {
      if (!item.id) continue;
      rows.push({
        id: item.id,
        summary: item.summary ?? item.id,
        primary: item.primary === true,
        accessRole: item.accessRole ?? null,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return rows;
}
