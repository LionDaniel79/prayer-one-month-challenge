import { describe, expect, it } from "vitest";
import { prayerRequests } from "../../src/db/schema";

describe("prayer request schema", () => {
  it("defines private prayer request fields", () => {
    expect(prayerRequests.id).toBeDefined();
    expect(prayerRequests.userId).toBeDefined();
    expect(prayerRequests.content).toBeDefined();
    expect(prayerRequests.status).toBeDefined();
  });
});
