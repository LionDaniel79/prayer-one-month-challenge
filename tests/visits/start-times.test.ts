import { describe, expect, it } from "vitest";
import { getVisitStartTimes, describeVisitStartTimes } from "../../src/features/visits/start-times";
import type { CalendarEventLike } from "../../src/features/visits/types";

const date = "2026-11-13";
const timed = (start: string, end: string): CalendarEventLike => ({
  start: { dateTime: `${date}T${start}:00+09:00` },
  end: { dateTime: `${date}T${end}:00+09:00` },
});

describe("visit start-time guidance", () => {
  it("subtracts the visit duration from each opening after a 30-minute event buffer", () => {
    const times = getVisitStartTimes(date, [timed("14:00", "15:00")]);
    expect(times).toEqual({
      personal: [{ start: "10:00", end: "12:30" }, { start: "15:30", end: "16:00" }],
      sam: [{ start: "10:00", end: "11:30" }],
    });
    expect(describeVisitStartTimes(times!.personal, "personal")).toBe(
      "심방 시작 기준으로 오전 10시~낮 12시 30분과 오후 3시 30분~오후 4시에 신청할 수 있습니다.",
    );
    expect(describeVisitStartTimes(times!.sam, "sam")).toBe(
      "심방 시작 기준으로 오전 10시~오전 11시 30분에 신청할 수 있습니다.",
    );
  });

  it("finishes by 17:00 even with no events", () => {
    expect(getVisitStartTimes(date, [])).toEqual({
      personal: [{ start: "10:00", end: "16:00" }],
      sam: [{ start: "10:00", end: "15:00" }],
    });
  });

  it("merges overlapping and touching buffered events in any order", () => {
    expect(getVisitStartTimes(date, [timed("14:00", "15:00"), timed("12:00", "13:00"), timed("12:30", "14:00")])).toEqual({
      personal: [{ start: "10:00", end: "10:30" }, { start: "15:30", end: "16:00" }],
      sam: [],
    });
  });

  it("keeps a single valid start and explains when a longer visit cannot fit", () => {
    const times = getVisitStartTimes(date, [timed("11:30", "18:00")])!;
    expect(times.personal).toEqual([{ start: "10:00", end: "10:00" }]);
    expect(describeVisitStartTimes(times.personal, "personal")).toBe("심방 시작 기준으로 오전 10시에 신청할 수 있습니다.");
    expect(describeVisitStartTimes(times.sam, "sam")).toBe("샘심방에 필요한 2시간을 확보할 수 있는 시작 시간이 없습니다.");
  });

  it("applies buffers to events immediately outside the visiting hours", () => {
    expect(getVisitStartTimes(date, [timed("08:00", "09:45"), timed("17:15", "18:00")])).toEqual({
      personal: [{ start: "10:15", end: "15:45" }],
      sam: [{ start: "10:15", end: "14:45" }],
    });
  });

  it("uses Seoul time regardless of the event offset and clips overnight events", () => {
    const events = [
      { start: { dateTime: "2026-11-13T05:00:00Z" }, end: { dateTime: "2026-11-13T06:00:00Z" } },
      { start: { dateTime: "2026-11-12T23:00:00+09:00" }, end: { dateTime: "2026-11-13T10:00:00+09:00" } },
    ];
    expect(getVisitStartTimes(date, events)?.personal).toEqual([
      { start: "10:30", end: "12:30" }, { start: "15:30", end: "16:00" },
    ]);
  });

  it("uses an exclusive all-day end and ignores cancelled events", () => {
    const allDay = { start: { date: "2026-11-12" }, end: { date } };
    expect(getVisitStartTimes(date, [allDay, { ...timed("10:00", "17:00"), status: "cancelled" }])).toEqual(getVisitStartTimes(date, []));
    expect(getVisitStartTimes(date, [{ start: { date }, end: { date: "2026-11-15" } }])).toEqual({ personal: [], sam: [] });
  });

  it("rounds inward to whole minutes so seconds never erode a buffer", () => {
    const event = { start: { dateTime: `${date}T14:00:30+09:00` }, end: { dateTime: `${date}T15:00:30+09:00` } };
    expect(getVisitStartTimes(date, [event])?.personal).toEqual([
      { start: "10:00", end: "12:30" }, { start: "15:31", end: "16:00" },
    ]);
  });

  it.each([
    { start: { dateTime: "invalid" }, end: { dateTime: `${date}T15:00:00+09:00` } },
    { start: { dateTime: `${date}T14:00:00` }, end: { dateTime: `${date}T15:00:00` } },
    timed("15:00", "14:00"),
    { start: { date: "2026-02-30" }, end: { date } },
    {},
  ])("does not advertise free hours when event times cannot be trusted: %j", (event) => {
    expect(getVisitStartTimes(date, [event])).toBeNull();
  });
});
