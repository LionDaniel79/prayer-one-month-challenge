import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarProvider, type CalendarClientLike } from "../../src/features/google-calendar/provider";
import { cancelVisit, type VisitAdminRepository } from "../../src/features/visits/admin-service";

function setup() {
  const remove = vi.fn().mockResolvedValue({ data: {} });
  const client: CalendarClientLike = { events: {
    list: vi.fn().mockResolvedValue({ data: { items: [] } }),
    insert: vi.fn().mockResolvedValue({ data: { id: "event-1" } }),
    update: vi.fn().mockResolvedValue({ data: {} }),
    delete: remove,
  } };
  return { remove, provider: new GoogleCalendarProvider(client, "calendar-1") };
}

describe("Google Calendar deletion retries", () => {
  it.each([{ response: { status: 410 } }, { code: 410 }, { code: "410" }])("accepts an already deleted event: %j", async (error) => {
    const { remove, provider } = setup();
    remove.mockRejectedValue(error);
    await expect(provider.deleteVisitEvent("event-1")).resolves.toBeUndefined();
  });

  it.each([401, 403, 404, 429, 500, 503])("does not hide HTTP %s as successful cancellation", async (status) => {
    const { remove, provider } = setup();
    const error = { response: { status } };
    remove.mockRejectedValue(error);
    await expect(provider.deleteVisitEvent("event-1")).rejects.toBe(error);
  });

  it("does not hide transport failures", async () => {
    const { remove, provider } = setup();
    const error = new Error("connection reset");
    remove.mockRejectedValue(error);
    await expect(provider.deleteVisitEvent("event-1")).rejects.toBe(error);
  });

  it("allows cancellation to recover after Google succeeded but the DB failed", async () => {
    const { remove, provider } = setup();
    remove.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { status: 410 } });
    const transition = vi.fn().mockRejectedValueOnce(new Error("temporary database outage")).mockResolvedValueOnce(undefined);
    const repository: VisitAdminRepository = {
      getById: async () => ({ id: "visit-1", requesterName: "테스트", visitDate: "2026-10-01", visitType: "personal", attendees: "테스트", location: "교회", preferredTime: "오후", reason: "비공개", status: "requested", calendarSyncStatus: "synced", googleEventId: "event-1" }),
      updateDetails: vi.fn(), setSyncStatus: vi.fn(), transition,
    };
    await expect(cancelVisit("visit-1", provider, repository)).rejects.toThrow("temporary database outage");
    await expect(cancelVisit("visit-1", provider, repository)).resolves.toBeUndefined();
    expect(transition).toHaveBeenLastCalledWith("visit-1", { status: "cancelled" });
  });
});
