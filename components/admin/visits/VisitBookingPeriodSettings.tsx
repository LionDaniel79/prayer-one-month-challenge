"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
import type { BookingPeriod } from "../../../src/features/visits/booking-period";

export function VisitBookingPeriodSettings() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<{ period: BookingPeriod }>("/api/admin/visits/booking-period", { cache: "no-store", signal: controller.signal })
      .then(({ period }) => {
        setStartDate(period.startDate ?? ""); setEndDate(period.endDate ?? ""); setLoaded(true);
        setMessage(period.startDate ? `현재 신청 가능 기간: ${period.startDate} ~ ${period.endDate}` : "현재 신청 기간 제한이 없습니다.");
      })
      .catch(() => { if (!controller.signal.aborted) setError("신청 기간을 불러오지 못했습니다. 다시 확인해 주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function save(clear = false) {
    if (busy || !loaded) return;
    if (!clear && (!startDate || !endDate || startDate > endDate)) {
      setError("시작일과 종료일을 입력해 주세요. 종료일은 시작일보다 빠를 수 없습니다."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const { period } = await fetchJson<{ period: BookingPeriod }>("/api/admin/visits/booking-period", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ startDate: clear ? null : startDate, endDate: clear ? null : endDate }),
      });
      setStartDate(period.startDate ?? ""); setEndDate(period.endDate ?? "");
      setMessage(period.startDate ? `신청 기간을 저장했습니다: ${period.startDate} ~ ${period.endDate}` : "신청 기간 제한을 해제했습니다.");
    } catch { setError("신청 기간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return (
    <section className="booking-period-setting" aria-labelledby="booking-period-heading">
      <h3 id="booking-period-heading">심방 신청 날짜 범위</h3>
      <p className="helper-text">시작일부터 종료일까지의 심방 날짜만 신청할 수 있습니다. 특정 날짜를 활성화해도 이 범위 안에서만 적용됩니다. 이미 접수된 신청은 유지됩니다.</p>
      <form className="booking-period-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label>신청 가능 시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={loading || busy || !loaded} required /></label>
        <label>신청 가능 종료일<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} disabled={loading || busy || !loaded} required /></label>
        <div className="specific-date-actions">
          <button className="primary-button compact-button" type="submit" disabled={loading || busy || !loaded}>{busy ? "저장 중…" : "신청 기간 저장"}</button>
          <button className="text-button" type="button" onClick={() => void save(true)} disabled={loading || busy || !loaded}>기간 제한 해제</button>
        </div>
      </form>
      {loading && <p className="helper-text">신청 기간을 불러오는 중…</p>}
      {message && <p className="helper-text" role="status">{message}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {!loading && !loaded && <button className="text-button" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>기간 다시 확인</button>}
    </section>
  );
}
