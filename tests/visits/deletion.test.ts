import { describe, expect, it, vi } from "vitest";
import { deleteVisit, cancelVisit, type AdminVisitRecord } from "../../src/features/visits/admin-service";

const visit: AdminVisitRecord = {
  id: "v1", requesterName: "검증", visitDate: "2026-10-08", visitType: "personal",
  attendees: "검증", location: "교회", preferredTime: "오후", reason: "비공개",
  status: "requested", calendarSyncStatus: "synced", googleEventId: "event-1",
};

describe("administrative visit deletion", () => {
  it("removes the linked Calendar event before deleting the application record", async () => {
    const calls: string[] = [];
    await deleteVisit("v1", async () => ({ async deleteVisitEvent(id: string) { calls.push(id); } }), {
      async getById() { return visit; }, async setSyncStatus() {},
      async deleteById(id: string) { calls.push(id); },
    });
    expect(calls).toEqual(["event-1", "v1"]);
  });

  it("preserves the record for retry when Calendar deletion fails", async () => {
    const remove = vi.fn();
    await expect(deleteVisit("v1", async () => ({ async deleteVisitEvent() { throw new Error("offline"); } }), {
      async getById() { return visit; }, async setSyncStatus() {}, deleteById: remove,
    })).rejects.toMatchObject({ code: "CALENDAR_EVENT_DELETE_FAILED" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("cleans up a retained Google event even on a cancelled, synced record", async () => {
    const removeGoogle = vi.fn();
    await deleteVisit("v1", async () => ({ deleteVisitEvent: removeGoogle }), {
      async getById() { return { ...visit, status: "cancelled" }; }, async setSyncStatus() {}, async deleteById() {},
    });
    expect(removeGoogle).toHaveBeenCalledWith("event-1");
  });

  it("rejects cancellation while initial event creation is in flight", async () => {
    const transition = vi.fn();
    await expect(cancelVisit("v1", {
      async listEvents() { return []; }, async createVisitEvent() { return { eventId: "event-1" }; },
      async updateVisitEvent() {}, async deleteVisitEvent() {},
    }, { async getById() { return { ...visit, calendarSyncStatus: "pending", googleEventId: null }; },
      async updateDetails() {}, async setSyncStatus() {}, transition,
    })).rejects.toMatchObject({ code: "VISIT_SYNC_PENDING" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("can remove already-cancelled records without reconnecting Google", async () => {
    const resolveProvider = vi.fn();
    const remove = vi.fn();
    await deleteVisit("v1", resolveProvider, {
      async getById() { return { ...visit, status: "cancelled", googleEventId: null }; }, async setSyncStatus() {}, deleteById: remove,
    });
    expect(resolveProvider).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("v1");
  });

  it("does not delete a record while initial Google creation is still in flight", async () => {
    const remove = vi.fn();
    await expect(deleteVisit("v1", vi.fn(), {
      async getById() { return { ...visit, calendarSyncStatus: "pending", googleEventId: null }; },
      async setSyncStatus() {}, deleteById: remove,
    })).rejects.toMatchObject({ code: "VISIT_SYNC_PENDING" });
    expect(remove).not.toHaveBeenCalled();
  });
});
