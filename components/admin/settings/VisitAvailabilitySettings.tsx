"use client";

import { useEffect, useState } from "react";

type BlockedDate = {
  visitDate: string;
  reason: string | null;
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
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.code ?? "VISIT_AVAILABILITY_SETTINGS_FAILED");
  }
  return body;
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
      const weekdayBody = await readJson("/api/admin/visits/blocked-weekdays");
      const dateBody = await readJson("/api/admin/visits/blocked-dates");
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

    void readJson("/api/admin/visits/blocked-weekdays")
      .then(async (weekdayBody) => {
        const dateBody = await readJson("/api/admin/visits/blocked-dates");
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

  async function addDate() {
    if (!visitDate || busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/blocked-dates", {
        method: "POST",
        body: JSON.stringify({
          visitDate,
          reason: reason.trim() || null,
        }),
      });
      setVisitDate("");
      setReason("");
      await load();
    } catch (cause) {
      setError(
        errorCopy(cause instanceof Error ? cause.message : "날짜를 비활성화하지 못했습니다."),
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
        errorCopy(cause instanceof Error ? cause.message : "비활성 날짜를 해제하지 못했습니다."),
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
          <h3>특정 날짜 비활성화</h3>
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
            <button
              className="primary-button compact-button"
              type="button"
              disabled={busy || !visitDate}
              onClick={() => void addDate()}
            >
              날짜 비활성화
            </button>
          </div>

          <div className="blocked-date-list">
            {dates.length === 0 ? (
              <p className="helper-text">별도로 비활성화한 날짜가 없습니다.</p>
            ) : (
              dates.map((date) => (
                <div className="blocked-date-row" key={date.visitDate}>
                  <span>
                    <strong>{date.visitDate}</strong>
                    {date.reason && <small>{date.reason}</small>}
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void removeDate(date.visitDate)}
                  >
                    해제
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
