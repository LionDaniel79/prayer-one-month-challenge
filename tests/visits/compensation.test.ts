import { describe, expect, it } from "vitest";
import type {
  CalendarProvider,
  VisitCalendarEventInput,
} from "../../src/features/visits/calendar-provider";
import {
  submitVisitRequest,
  type VisitRepository,
} from "../../src/features/visits/service";

function repo(overrides: Partial<VisitRepository> = {}): VisitRepository {
  return {
    async listBlockedDates() { return []; },
    async listBlockedWeekdays() { return []; },
    async listActiveVisitDates() { return []; },
    async isDateBlocked() { return false; },
    async isWeekdayBlocked() { return false; },
    async hasActiveVisit() { return false; },
    async getRequester(userId) {
      return { id: userId, displayName: "홍길동" };
    },
    async createPending() { return { id: "v1", status: "requested" }; },
    async markSynced() {},
    async cancelAfterSyncFailure() {},
    ...overrides,
  };
}

function calendar(overrides: Partial<CalendarProvider> = {}): CalendarProvider {
  return {
    async listEvents() { return []; },
    async createVisitEvent() { return { eventId: "g1" }; },
    async updateVisitEvent() {},
    async deleteVisitEvent() {},
    ...overrides,
  };
}

const input = {
  requesterUserId: "u1",
  visitDate: "2026-10-08",
  visitType: "personal" as const,
  attendees: "홍길동",
  location: "교회",
  preferredTime: "오후",
  reason: "비공개 심방 이유",
};

describe("visit booking compensation", () => {
  it("cancels the pending DB request when Google event creation fails", async () => {
    let cancelled = false;
    await expect(
      submitVisitRequest(
        input,
        calendar({
          async createVisitEvent() {
            throw new Error("google failed");
          },
        }),
        repo({
          async cancelAfterSyncFailure() {
            cancelled = true;
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "CALENDAR_EVENT_CREATE_FAILED" });

    expect(cancelled).toBe(true);
  });

  it("deletes the Google event when saving its event id fails", async () => {
    const deleted: string[] = [];
    await expect(
      submitVisitRequest(
        input,
        calendar({
          async deleteVisitEvent(eventId) {
            deleted.push(eventId);
          },
        }),
        repo({
          async markSynced() {
            throw new Error("db update failed");
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "CALENDAR_EVENT_SYNC_FAILED" });

    expect(deleted).toEqual(["g1"]);
  });

  it("never returns success even when Google cleanup also fails", async () => {
    let cancelled = false;

    await expect(
      submitVisitRequest(
        input,
        calendar({
          async deleteVisitEvent() {
            throw new Error("cleanup failed");
          },
        }),
        repo({
          async markSynced() {
            throw new Error("db update failed");
          },
          async cancelAfterSyncFailure() {
            cancelled = true;
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "CALENDAR_EVENT_SYNC_FAILED" });

    expect(cancelled).toBe(true);
  });

  it("keeps the private reason structurally absent from Calendar input", async () => {
    let captured: VisitCalendarEventInput | null = null;
    await submitVisitRequest(
      input,
      calendar({
        async createVisitEvent(value) {
          captured = value;
          return { eventId: "g1" };
        },
      }),
      repo(),
    );

    expect(captured).not.toHaveProperty("reason");
  });
});
