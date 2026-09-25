import { describe, expect, it } from "vitest";
import type { CalendarProvider } from "../../src/features/visits/calendar-provider";
import {
  canTransitionVisit,
  updateVisitDetails,
  type VisitAdminRepository,
} from "../../src/features/visits/admin-service";

describe("admin visit workflow", () => {
  it("allows only forward/cancel workflow transitions", () => {
    expect(canTransitionVisit("requested", "confirmed")).toBe(true);
    expect(canTransitionVisit("confirmed", "completed")).toBe(true);
    expect(canTransitionVisit("requested", "cancelled")).toBe(true);
    expect(canTransitionVisit("confirmed", "cancelled")).toBe(true);
    expect(canTransitionVisit("completed", "requested")).toBe(false);
    expect(canTransitionVisit("cancelled", "confirmed")).toBe(false);
  });

  it("updates Google when calendar-visible visit fields change", async () => {
    const updatedGoogle: string[] = [];
    const provider: CalendarProvider = {
      async listEvents() { return []; },
      async createVisitEvent() { return { eventId: "unused" }; },
      async updateVisitEvent(eventId) {
        updatedGoogle.push(eventId);
      },
      async deleteVisitEvent() {},
    };

    const repository: VisitAdminRepository = {
      async getById() {
        return {
          id: "v1",
          requesterName: "홍길동",
          visitDate: "2026-10-08",
          visitType: "personal",
          attendees: "홍길동",
          location: "교회",
          preferredTime: "오후",
          reason: "비공개 이유",
          status: "requested",
          calendarSyncStatus: "synced",
          googleEventId: "g1",
        };
      },
      async updateDetails() {},
      async setSyncStatus() {},
      async transition() {},
    };

    await updateVisitDetails(
      "v1",
      {
        location: "가정",
        preferredTime: "오후 3시",
      },
      provider,
      repository,
    );

    expect(updatedGoogle).toEqual(["g1"]);
  });
});
