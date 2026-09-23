"use client";

import type { MemberDashboard } from "../../src/lib/types";
import { addDays, isMutablePrayerDate, isPrayerDay } from "../../src/features/challenge/date";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

function utcDay(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function calendarBounds(start: string, end: string) {
  const startDay = utcDay(start);
  const startOffset = startDay === 0 ? 6 : startDay - 1;
  const endDay = utcDay(end);
  const endOffset = endDay === 0 ? 0 : 7 - endDay;
  return { first: addDays(start, -startOffset), last: addDays(end, endOffset) };
}

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return { month: Number(month), day: Number(day) };
}

export function PrayerCalendar({
  dashboard,
  onToggle,
  pendingDates,
}: {
  dashboard: MemberDashboard;
  onToggle: (date: string) => void;
  pendingDates: ReadonlySet<string>;
}) {
  const checked = new Set(dashboard.completedDates);
  const { first, last } = calendarBounds(
    dashboard.challenge.startDate,
    dashboard.challenge.endDate,
  );
  const cells: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) cells.push(cursor);

  return (
    <section className="calendar-card card" aria-label="기도 완료 달력">
      <div className="weekday-row">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((date) => {
          const inside = date >= dashboard.challenge.startDate && date <= dashboard.challenge.endDate;
          const mutable = inside && isMutablePrayerDate({
            prayerDate: date,
            today: dashboard.today,
            startDate: dashboard.challenge.startDate,
            endDate: dashboard.challenge.endDate,
          });
          const pending = pendingDates.has(date);
          const done = checked.has(date);
          const sunday = !isPrayerDay(date);
          const today = date === dashboard.today;
          const { month, day } = shortDate(date);
          const action = done ? "기도 완료 취소" : "기도 완료 체크";
          const reason = !inside ? "도전 기간 밖" : sunday ? "일요일" : mutable ? "" : "수정 기간 지남";
          return (
            <button
              key={date}
              type="button"
              className={[
                "calendar-cell",
                !inside ? "is-outside" : "",
                sunday ? "is-sunday" : "",
                done ? "is-checked" : "",
                today ? "is-today" : "",
                mutable ? "is-mutable" : "",
                pending ? "is-pending" : "",
              ].filter(Boolean).join(" ")}
              disabled={!mutable || pending}
              onClick={() => onToggle(date)}
              aria-busy={pending || undefined}
              aria-label={`${month}월 ${day}일 ${mutable ? action : reason}`}
              title={reason || action}
            >
              <span className="date-number">{day}</span>
              {done && <span className="check-mark" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>✓ 기도 완료</span>
        <span>테두리: 오늘</span>
      </div>
    </section>
  );
}
