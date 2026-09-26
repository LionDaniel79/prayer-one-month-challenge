import { describe, expect, it } from "vitest";
import type { CalendarProvider } from "../../src/features/visits/calendar-provider";
import {
  canTransitionVisit,
  cancelVisit,
  confirmVisit,
  findBlockedWeekdayConflicts,
  updateVisitDetails,
  type VisitAdminRepository,
} from "../../src/features/visits/admin-service";

describe("admin visit workflow", () => {
  it("finds future visits that conflict with newly blocked weekdays", () => {
    expect(
      findBlockedWeekdayConflicts(
        ["2026-10-04", "2026-10-05", "2026-10-11"],
        new Set([0]),
      ),
    ).toEqual(["2026-10-04", "2026-10-11"]);
  });

  it("allows only forward/cancel workflow transitions", () => {
    expect(canTransitionVisit("requested", "confirmed")).toBe(true);
    expect(canTransitionVisit("confirmed", "completed")).toBe(true);
    expect(canTransitionVisit("requested", "cancelled")).toBe(true);
    expect(canTransitionVisit("confirmed", "cancelled")).toBe(true);
    expect(canTransitionVisit("completed", "requested")).toBe(false);
    expect(canTransitionVisit("cancelled", "confirmed")).toBe(false);
  });

  it("does not advance DB status when Google confirmation update fails", async () => {
    let transitioned = false;
    const provider: CalendarProvider = {
      async listEvents() { return []; },
      async createVisitEvent() { return { eventId: "unused" }; },
      async updateVisitEvent() { throw new Error("google failed"); },
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
      async transition() { transitioned = true; },
    };

    await expect(
      confirmVisit("v1", "admin1", provider, repository),
    ).rejects.toMatchObject({ code: "CALENDAR_EVENT_UPDATE_FAILED" });
    expect(transitioned).toBe(false);
  });

  it("does not cancel DB status when Google event deletion fails", async () => {
    let transitioned = false;
    const provider: CalendarProvider = {
      async listEvents() { return []; },
      async createVisitEvent() { return { eventId: "unused" }; },
      async updateVisitEvent() {},
      async deleteVisitEvent() { throw new Error("google failed"); },
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
      async transition() { transitioned = true; },
    };

    await expect(
      cancelVisit("v1", provider, repository),
    ).rejects.toMatchObject({ code: "CALENDAR_EVENT_DELETE_FAILED" });
    expect(transitioned).toBe(false);
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
