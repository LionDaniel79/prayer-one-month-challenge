import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin integration settings UI", () => {
  it("manages Google Calendar and visit availability", () => {
    const google = readFileSync(
      "components/admin/settings/GoogleCalendarSettings.tsx",
      "utf8",
    );
    const availability = readFileSync(
      "components/admin/settings/VisitAvailabilitySettings.tsx",
      "utf8",
    );
    expect(google).toContain("Google Calendar 연결");
    expect(google).toContain("캘린더");
    expect(availability).toContain("반복 비활성 요일");
    expect(availability).toContain("특정 날짜");
  });

  it("never renders secret configuration names or values", () => {
    const sources = [
      "components/admin/settings/GoogleCalendarSettings.tsx",
      "components/admin/settings/PushSettingsStatus.tsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(sources).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
  });
});
