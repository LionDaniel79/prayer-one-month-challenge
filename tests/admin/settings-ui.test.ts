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

  it("moves Calendar to visits and removes Settings and Push card", () => {
    const visits=readFileSync("app/admin/visits/page.tsx","utf8");
    const old=readFileSync("app/admin/settings/page.tsx","utf8");
    const nav=readFileSync("components/admin/AdminSidebar.tsx","utf8");
    expect(visits.indexOf("<GoogleCalendarSettings")).toBeGreaterThan(visits.indexOf("<VisitAvailabilitySettings"));
    expect(old).toContain('redirect("/admin/visits#google-calendar")');
    expect(nav).not.toContain('/admin/settings');
    expect(visits).not.toContain('PushSettingsStatus');
  });
  it("never renders secret configuration names or values", () => {
    const sources = [
      "components/admin/settings/GoogleCalendarSettings.tsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(sources).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
  });
});
