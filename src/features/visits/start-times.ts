import { addDays } from "../challenge/date";
import type { CalendarEventLike, VisitStartTimes, VisitStartWindow, VisitType } from "./types";

const MINUTE = 60_000;
const BUFFER = 30 * MINUTE;
const DURATION = { personal: 60, sam: 120 };

function seoulMidnight(date: string): number {
  // Validate calendar dates too (Date.parse otherwise normalizes February 30).
  return Date.parse(addDays(date, 0) + "T00:00:00+09:00");
}

function eventBounds(event: CalendarEventLike): [number, number] | null {
  let start: number;
  let end: number;
  if (event.start?.date && event.end?.date) {
    start = seoulMidnight(event.start.date);
    end = seoulMidnight(event.end.date); // Google all-day end is exclusive.
  } else {
    const first = event.start?.dateTime;
    const last = event.end?.dateTime;
    if (!first || !last || !/(Z|[+-]\d{2}:\d{2})$/i.test(first) || !/(Z|[+-]\d{2}:\d{2})$/i.test(last)) return null;
    start = Date.parse(first);
    end = Date.parse(last);
  }
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
}

function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function getVisitStartTimes(date: string, events: CalendarEventLike[]): VisitStartTimes | null {
  try {
    const midnight = seoulMidnight(date);
    const open = midnight + 10 * 60 * MINUTE;
    const close = midnight + 17 * 60 * MINUTE;
    const blocked: [number, number][] = [];
    for (const event of events) {
      if (event.status === "cancelled") continue;
      const bounds = eventBounds(event);
      if (!bounds) return null;
      const start = Math.max(open, bounds[0] - BUFFER);
      const end = Math.min(close, bounds[1] + BUFFER);
      if (start < end) blocked.push([start, end]);
    }
    blocked.sort((a, b) => a[0] - b[0]);
    const free: [number, number][] = [];
    let cursor = open;
    for (const [start, end] of blocked) {
      if (cursor < start) free.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < close) free.push([cursor, close]);

    function startsFor(type: VisitType): VisitStartWindow[] {
      return free.flatMap(([start, end]) => {
        // Inclusive start ranges, rounded inward to preserve the full buffer.
        const first = Math.ceil((start - midnight) / MINUTE);
        const last = Math.floor((end - midnight) / MINUTE) - DURATION[type];
        return first <= last ? [{ start: clockTime(first), end: clockTime(last) }] : [];
      });
    }
    return { personal: startsFor("personal"), sam: startsFor("sam") };
  } catch {
    return null;
  }
}

function koreanTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour < 12 ? "오전" : hour === 12 ? "낮" : "오후";
  return `${period} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ""}`;
}

export function describeVisitStartTimes(windows: VisitStartWindow[], type: VisitType): string {
  if (!windows.length) return `${type === "personal" ? "개인심방에 필요한 1시간" : "샘심방에 필요한 2시간"}을 확보할 수 있는 시작 시간이 없습니다.`;
  const ranges = windows.map(({ start, end }) => start === end ? koreanTime(start) : `${koreanTime(start)}~${koreanTime(end)}`);
  const text = ranges.reduce((all, range) => all ? `${all}${all.endsWith("분") ? "과" : "와"} ${range}` : range, "");
  return `심방 시작 기준으로 ${text}에 신청할 수 있습니다.`;
}
