import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { googleCalendarConnections } from "../../db/schema";
import { DomainError } from "../../lib/http";

export type GoogleCalendarConnection = {
  id: string;
  connectedByUserId: string;
  googleAccountEmail: string | null;
  refreshTokenCiphertext: string;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
};

export async function getGoogleCalendarConnection(): Promise<GoogleCalendarConnection | null> {
  const [row] = await getDb()
    .select({
      id: googleCalendarConnections.id,
      connectedByUserId: googleCalendarConnections.connectedByUserId,
      googleAccountEmail: googleCalendarConnections.googleAccountEmail,
      refreshTokenCiphertext: googleCalendarConnections.refreshTokenCiphertext,
      selectedCalendarId: googleCalendarConnections.selectedCalendarId,
      selectedCalendarName: googleCalendarConnections.selectedCalendarName,
    })
    .from(googleCalendarConnections)
    .limit(1);

  return row ?? null;
}

export async function saveGoogleCalendarConnection(input: {
  connectedByUserId: string;
  googleAccountEmail: string | null;
  refreshTokenCiphertext: string;
}): Promise<string> {
  const db = getDb();
  const existing = await getGoogleCalendarConnection();

  if (existing) {
    await db
      .update(googleCalendarConnections)
      .set({
        connectedByUserId: input.connectedByUserId,
        googleAccountEmail: input.googleAccountEmail,
        refreshTokenCiphertext: input.refreshTokenCiphertext,
        selectedCalendarId: null,
        selectedCalendarName: null,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(googleCalendarConnections)
    .values({
      connectedByUserId: input.connectedByUserId,
      googleAccountEmail: input.googleAccountEmail,
      refreshTokenCiphertext: input.refreshTokenCiphertext,
    })
    .returning({ id: googleCalendarConnections.id });

  return created.id;
}

export async function selectGoogleCalendar(
  calendarId: string,
  calendarName: string,
): Promise<void> {
  const connection = await getGoogleCalendarConnection();
  if (!connection) {
    throw new DomainError("CALENDAR_NOT_CONNECTED", 409);
  }

  await getDb()
    .update(googleCalendarConnections)
    .set({
      selectedCalendarId: calendarId,
      selectedCalendarName: calendarName,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarConnections.id, connection.id));
}

export async function deleteGoogleCalendarConnection(): Promise<void> {
  const connection = await getGoogleCalendarConnection();
  if (!connection) return;

  await getDb()
    .delete(googleCalendarConnections)
    .where(eq(googleCalendarConnections.id, connection.id));
}
