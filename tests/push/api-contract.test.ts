import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("push subscription API contract", () => {
  it("exposes only the public VAPID key to the browser", () => {
    const source = readFileSync("app/api/push/public-key/route.ts", "utf8");
    expect(source).toContain("WEB_PUSH_VAPID_PUBLIC_KEY");
    expect(source).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
  });

  it("binds subscriptions to the current session user", () => {
    const source = readFileSync("app/api/push/subscribe/route.ts", "utf8");
    expect(source).toContain("getCurrentSessionUser");
    expect(source).toContain("savePushSubscription");
    expect(source).toContain("removePushSubscription");
  });

  it("requires a user click before requesting notification permission", () => {
    const source = readFileSync("components/notices/PushOptIn.tsx", "utf8");
    expect(source).toContain("Notification.requestPermission");
    expect(source).toContain("onClick");
  });
});
