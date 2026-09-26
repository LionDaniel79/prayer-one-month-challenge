import { describe, expect, it } from "vitest";
import { fanOutPush } from "../../src/features/push/service";

describe("push fan-out", () => {
  it("prunes a 410 subscription and continues other deliveries", async () => {
    const removed: string[] = [];
    const sent: string[] = [];

    const result = await fanOutPush(
      [
        { endpoint: "https://push.example/expired", p256dh: "p1", auth: "a1" },
        { endpoint: "https://push.example/good", p256dh: "p2", auth: "a2" },
      ],
      async (target) => {
        if (target.endpoint.endsWith("/expired")) {
          throw Object.assign(new Error("gone"), { statusCode: 410 });
        }
        sent.push(target.endpoint);
      },
      async (endpoint) => {
        removed.push(endpoint);
      },
    );

    expect(removed).toEqual(["https://push.example/expired"]);
    expect(sent).toEqual(["https://push.example/good"]);
    expect(result).toEqual({
      attempted: 2,
      sent: 1,
      expired: 1,
      failed: 0,
    });
  });

  it("counts ordinary delivery errors without aborting fan-out", async () => {
    const result = await fanOutPush(
      [
        { endpoint: "https://push.example/fail", p256dh: "p1", auth: "a1" },
        { endpoint: "https://push.example/good", p256dh: "p2", auth: "a2" },
      ],
      async (target) => {
        if (target.endpoint.endsWith("/fail")) throw new Error("network");
      },
      async () => undefined,
    );

    expect(result).toEqual({
      attempted: 2,
      sent: 1,
      expired: 0,
      failed: 1,
    });
  });
});
