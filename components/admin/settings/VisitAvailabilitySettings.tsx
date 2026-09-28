"use client";

import { fetchJson } from "../../../src/lib/fetch-json";
import { useEffect, useState } from "react";
import { VisitBookingPeriodSettings } from "../visits/VisitBookingPeriodSettings";

type BlockedDate = {
  visitDate: string;
  reason: string | null;
  isEnabled: boolean;
};

const weekdayOptions = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
] as const;

async function readJson(url: string, init?: RequestInit) {
  return fetchJson<{ weekdays?: number[]; dates?: BlockedDate[] }>(url, {
    cache: "no-store", ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
}

function errorCopy(code: string) {
  if (code === "BLOCK_CONFLICTS_WITH_VISIT") {
    return "이미 심방 신청이 있는 날짜는 비활성화할 수 없습니다.";
  }
  if (code === "BLOCKED_WEEKDAY_CONFLICTS_WITH_VISITS") {
    return "해당 요일에 이미 예정된 심방이 있어 반복 비활성화할 수 없습니다.";
  }
  return code;
}

export function VisitAvailabilitySettings() {
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [dates, setDates] = useState<BlockedDate[]>([]);
  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [weekdayBody, dateBody] = await Promise.all([readJson("/api/admin/visits/blocked-weekdays"), readJson("/api/admin/visits/blocked-dates")]);
      setWeekdays(new Set((weekdayBody.weekdays ?? []) as number[]));
      setDates((dateBody.dates ?? []) as BlockedDate[]);
    } catch (cause) {
      setError(
        errorCopy(cause instanceof Error ? cause.message : "설정을 불러오지 못했습니다."),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.all([readJson("/api/admin/visits/blocked-weekdays"), readJson("/api/admin/visits/blocked-dates")])
      .then(([weekdayBody, dateBody]) => {
        if (!cancelled) {
          setWeekdays(new Set((weekdayBody.weekdays ?? []) as number[]));
          setDates((dateBody.dates ?? []) as BlockedDate[]);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            errorCopy(
              cause instanceof Error ? cause.message : "설정을 불러오지 못했습니다.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleWeekday(value: number, checked: boolean) {
    setWeekdays((current) => {
      const next = new Set(current);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  async function saveWeekdays() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/blocked-weekdays", {
        method: "PUT",
        body: JSON.stringify({
          weekdays: [...weekdays].sort((a, b) => a - b),
        }),
      });
    } catch (cause) {
      setError(
        errorCopy(cause instanceof Error ? cause.message : "반복 요일을 저장하지 못했습니다."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function addDate(isEnabled: boolean) {
    if (!visitDate || busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/blocked-dates", {
        method: "POST",
        body: JSON.stringify({
          visitDate,
          isEnabled,
          reason: reason.trim() || null,
        }),
      });
      setVisitDate("");
      setReason("");
      await load();
    } catch (cause) {
      setError(
        errorCopy(cause instanceof Error ? cause.message : "날짜 설정을 저장하지 못했습니다."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeDate(date: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/blocked-dates", {
        method: "DELETE",
        body: JSON.stringify({ visitDate: date }),
      });
      await load();
    } catch (cause) {
      setError(
        errorCopy(cause instanceof Error ? cause.message : "날짜 설정을 해제하지 못했습니다."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card admin-setting-card">
      <div>
        <h2>심방 신청 가능일</h2>
        <p className="helper-text">
          Google 일정과 별개로 반복 요일 또는 특정 날짜를 신청 불가로 설정할 수 있습니다.
        </p>
      </div>

      <div className="admin-setting-stack">
        <VisitBookingPeriodSettings />
        <fieldset className="weekday-setting">
          <legend>반복 비활성 요일</legend>
          <div className="weekday-setting-options">
            {weekdayOptions.map((item) => (
              <label key={item.value}>
                <input
                  type="checkbox"
                  checked={weekdays.has(item.value)}
                  onChange={(event) =>
                    toggleWeekday(item.value, event.target.checked)
                  }
                />
                {item.label}
              </label>
            ))}
          </div>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => void saveWeekdays()}
          >
            반복 요일 저장
          </button>
        </fieldset>

        <div className="specific-date-setting">
          <h3>특정 날짜 설정</h3>
          <p className="helper-text">활성화한 날짜는 반복 비활성 요일과 Google 일정이 있어도 신청할 수 있습니다. 이미 심방이 있는 날짜에는 중복 신청할 수 없습니다.</p>
          <div className="specific-date-form">
            <label>
              날짜
              <input
                type="date"
                value={visitDate}
                onChange={(event) => setVisitDate(event.target.value)}
              />
            </label>
            <label>
              메모
              <input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="선택 사항"
              />
            </label>
            <div className="specific-date-actions">
            <button className="primary-button compact-button" type="button" disabled={busy || !visitDate} onClick={() => void addDate(true)}>날짜 활성화</button>
            <button
              className="text-button compact-button"
              type="button"
              disabled={busy || !visitDate}
              onClick={() => void addDate(false)}
            >
              날짜 비활성화
            </button>
            </div>
          </div>

          <div className="blocked-date-list">
            {dates.length === 0 ? (
              <p className="helper-text">별도로 설정한 날짜가 없습니다.</p>
            ) : (
              dates.map((date) => (
                <div className="blocked-date-row" key={date.visitDate}>
                  <span>
                    <strong>{date.visitDate} · {date.isEnabled ? "활성" : "비활성"}</strong>
                    {date.reason && <small>{date.reason}</small>}
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void removeDate(date.visitDate)}
                  >
                    설정 해제
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
    </section>
  );
}
