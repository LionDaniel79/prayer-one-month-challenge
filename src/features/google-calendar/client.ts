import { google } from "googleapis";
import { DomainError } from "../../lib/http";
import { requireGoogleCalendarConfig } from "../../lib/env";
import { decryptGoogleRefreshToken } from "./crypto";
import { getGoogleCalendarConnection } from "./repository";

export function createGoogleOAuthClient(redirectUri?: string) {
  const config = requireGoogleCalendarConfig();
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    redirectUri,
  );
}

export async function getAuthorizedGoogleCalendarContext() {
  const connection = await getGoogleCalendarConnection();
  if (!connection) {
    throw new DomainError("CALENDAR_NOT_CONNECTED", 409);
  }

  const oauth = createGoogleOAuthClient();
  oauth.setCredentials({
    refresh_token: decryptGoogleRefreshToken(
      connection.refreshTokenCiphertext,
    ),
  });

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
