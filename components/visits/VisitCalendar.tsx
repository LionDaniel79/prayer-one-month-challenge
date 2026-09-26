"use client";

import { useEffect, useMemo, useState } from "react";
import type { VisitDateAvailability } from "../../src/features/visits/types";

function currentSeoulMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month;
}

function moveMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0")
  );
}

function dayNumber(date: string): number {
  return Number(date.slice(-2));
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const unavailableLabel: Record<string, string> = {
  past_date: "지난 날짜",
  calendar_unavailable: "일정 확인 불가",
  google_event: "기존 일정 있음",
  blocked_date: "신청 불가",
  blocked_weekday: "신청 불가 요일",
  existing_visit: "심방 신청 있음",
};

export function VisitCalendar({
  selectedDate,
  onSelect,
  refreshKey = 0,
}: {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  refreshKey?: number;
}) {
  const [month, setMonth] = useState(currentSeoulMonth);
  const [dates, setDates] = useState<VisitDateAvailability[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/visits/availability?month=" + encodeURIComponent(month), {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.code ?? "VISIT_AVAILABILITY_FAILED");
        }
        return body;
      })
      .then((body) => {
        if (!cancelled) {
          setDates(Array.isArray(body.dates) ? body.dates : []);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const code = error instanceof Error ? error.message : "";
        setDates([]);
        setMessage(
          code === "CALENDAR_NOT_CONNECTED"
            ? "관리자가 Google Calendar를 연결하면 심방 신청을 시작할 수 있습니다."
            : "일정을 확인하기 어렵습니다. 잠시 후 다시 시도해 주세요.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, refreshKey]);

  function navigateMonth(amount: number) {
    setLoading(true);
    setMessage("");
    setMonth((value) => moveMonth(value, amount));
  }

  const leadingCells = useMemo(() => {
    if (dates.length === 0) return 0;
    return weekday(dates[0].date);
  }, [dates]);

  return (
    <section className="card visit-calendar-card">
      <div className="visit-calendar-toolbar">
        <button
          type="button"
          className="text-button visit-month-button"
          onClick={() => navigateMonth(-1)}
          aria-label="이전 달"
        >
          ‹
        </button>
        <h3>{month.replace("-", "년 ")}월</h3>
        <button
          type="button"
          className="text-button visit-month-button"
          onClick={() => navigateMonth(1)}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="visit-weekdays" aria-hidden="true">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {loading ? (
        <div className="visit-calendar-message">일정을 확인하고 있습니다.</div>
      ) : message ? (
        <div className="visit-calendar-message" role="status">{message}</div>
      ) : (
        <div className="visit-calendar-grid">
          {Array.from({ length: leadingCells }, (_, index) => (
            <span className="visit-day-spacer" key={"spacer-" + index} />
          ))}
          {dates.map((item) => {
            const selected = selectedDate === item.date;
            const reason = item.available ? null : unavailableLabel[item.reason];

            return (
              <button
                key={item.date}
                type="button"
                className={[
                  "visit-day",
                  item.available ? "is-available" : "is-unavailable",
                  selected ? "is-selected" : "",
                ].filter(Boolean).join(" ")}
                disabled={!item.available}
                onClick={() => onSelect(item.date)}
                aria-label={
                  item.available
                    ? item.date + " 심방 신청 가능"
                    : item.date + " " + (reason ?? "신청 불가")
                }
              >
                <span>{dayNumber(item.date)}</span>
                <small>{item.available ? "신청 가능" : reason}</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="visit-calendar-legend">
        <span><i className="visit-dot is-free" /> 신청 가능</span>
        <span><i className="visit-dot is-busy" /> 신청 불가</span>
      </div>
    </section>
  );
}
