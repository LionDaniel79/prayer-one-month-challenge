import { beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({ current: null as null | {
  id: string; refreshTokenCiphertext: string; selectedCalendarId: string;
} }));
vi.mock("../../src/features/google-calendar/repository", () => ({
  getGoogleCalendarConnection: async () => connection.current,
}));
vi.mock("../../src/features/google-calendar/crypto", () => ({
  decryptGoogleRefreshToken: (value: string) => value,
}));
vi.mock("../../src/lib/env", () => ({
  requireGoogleCalendarConfig: () => ({ clientId: "test", clientSecret: "test" }),
}));

describe("Calendar authorization reuse", () => {
  beforeEach(() => {
    vi.resetModules();
    connection.current = { id: "one", refreshTokenCiphertext: "refresh-1", selectedCalendarId: "calendar-1" };
  });

  it("keeps a valid access token across reads without retaining stale calendar selection", async () => {
    const { getAuthorizedGoogleCalendarContext } = await import("../../src/features/google-calendar/client");
    const first = await getAuthorizedGoogleCalendarContext();
    first.oauth.setCredentials({ refresh_token: "refresh-1", access_token: "access-1", expiry_date: Date.now() + 3600_000 });
    connection.current = { ...connection.current!, selectedCalendarId: "calendar-2" };
    const next = await getAuthorizedGoogleCalendarContext();
    expect(next.oauth.credentials.access_token).toBe("access-1");
    expect(next.connection.selectedCalendarId).toBe("calendar-2");
  });

  it("drops cached authorization when credentials change or the connection is removed", async () => {
    const { getAuthorizedGoogleCalendarContext } = await import("../../src/features/google-calendar/client");
    const first = await getAuthorizedGoogleCalendarContext();
    first.oauth.setCredentials({ access_token: "old" });
    connection.current = { ...connection.current!, refreshTokenCiphertext: "refresh-2" };
    expect((await getAuthorizedGoogleCalendarContext()).oauth.credentials.access_token).toBeUndefined();
    connection.current = null;
    await expect(getAuthorizedGoogleCalendarContext()).rejects.toMatchObject({ code: "CALENDAR_NOT_CONNECTED" });
  });
});
