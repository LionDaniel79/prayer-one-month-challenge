import { describe, expect, it } from "vitest";
import { GoogleCalendarProvider } from "../../src/features/google-calendar/provider";

function fakeCalendar() {
  const calls: Array<{ method: string; args: unknown }> = [];
  let listCall = 0;

  return {
    calls,
    client: {
      events: {
        async list(args: unknown) {
          calls.push({ method: "list", args });
          listCall += 1;
          return listCall === 1
            ? {
                data: {
                  items: [{
                    status: "confirmed",
                    start: { date: "2026-10-03" },
                    end: { date: "2026-10-04" },
                  }],
                  nextPageToken: "page-2",
                },
              }
            : {
                data: {
                  items: [{
                    status: "confirmed",
                    start: { dateTime: "2026-10-04T10:00:00+09:00" },
                    end: { dateTime: "2026-10-04T11:00:00+09:00" },
                  }],
                },
              };
        },
        async insert(args: unknown) {
          calls.push({ method: "insert", args });
          return { data: { id: "google-event-1" } };
        },
        async update(args: unknown) {
          calls.push({ method: "update", args });
          return { data: {} };
        },
        async delete(args: unknown) {
          calls.push({ method: "delete", args });
          return { data: {} };
        },
      },
    },
  };
}

describe("Google Calendar provider", () => {
  it("paginates event listing with recurring instances expanded", async () => {
    const fake = fakeCalendar();
    const provider = new GoogleCalendarProvider(fake.client, "calendar-id");

    const events = await provider.listEvents({
      timeMin: "2026-10-01T00:00:00+09:00",
      timeMax: "2026-11-01T00:00:00+09:00",
    });

    expect(events).toHaveLength(2);
    const listCalls = fake.calls.filter((call) => call.method === "list");
    expect(listCalls).toHaveLength(2);
    expect(listCalls[0].args).toMatchObject({
      calendarId: "calendar-id",
      singleEvents: true,
      showDeleted: false,
      timeMin: "2026-10-01T00:00:00+09:00",
      timeMax: "2026-11-01T00:00:00+09:00",
    });
    expect(listCalls[1].args).toMatchObject({ pageToken: "page-2" });
  });

  it("creates an all-day visit event without private reason content", async () => {
    const fake = fakeCalendar();
    const provider = new GoogleCalendarProvider(fake.client, "calendar-id");

    const result = await provider.createVisitEvent({
      requesterName: "홍길동",
      visitDate: "2026-10-08",
      visitType: "personal",
      attendees: "홍길동, 김사랑",
      location: "가정",
      preferredTime: "오후 3시 이후",
      status: "requested",
    });

    expect(result).toEqual({ eventId: "google-event-1" });
    const insert = fake.calls.find((call) => call.method === "insert");
    expect(insert?.args).toMatchObject({
      calendarId: "calendar-id",
      requestBody: {
        start: { date: "2026-10-08" },
        end: { date: "2026-10-09" },
      },
    });
    const serialized = JSON.stringify(insert?.args);
    expect(serialized).toContain("신청자: 홍길동");
    expect(serialized).toContain("장소: 가정");
    expect(serialized).toContain("희망 시간: 오후 3시 이후");
    expect(serialized).toContain("참석자 명단: 홍길동, 김사랑");
    expect(serialized).not.toContain("심방 요청 이유");
  });
});
