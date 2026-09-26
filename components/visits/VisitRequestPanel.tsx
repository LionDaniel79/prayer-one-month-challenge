"use client";

import { FormEvent, useState } from "react";

export function VisitRequestPanel({
  visitDate,
  requesterName,
  onClose,
  onSuccess,
}: {
  visitDate: string;
  requesterName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [visitType, setVisitType] = useState<"personal" | "sam">("personal");
  const [attendees, setAttendees] = useState("");
  const [location, setLocation] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          visitDate,
          visitType,
          attendees,
          location,
          preferredTime,
          reason,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = body.code ?? "VISIT_REQUEST_FAILED";
        setMessage(
          code === "VISIT_ALREADY_EXISTS" || code === "VISIT_DATE_UNAVAILABLE"
            ? "방금 다른 일정이 등록되었습니다. 다른 날짜를 선택해 주세요."
            : code === "CALENDAR_NOT_CONNECTED"
              ? "관리자가 Google Calendar를 연결한 뒤 신청할 수 있습니다."
              : "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      setMessage("심방 신청이 전달되었습니다.");
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="visit-request-panel" aria-label="심방 신청하기">
      <div className="visit-panel-heading">
        <div>
          <p className="eyebrow">심방 신청하기</p>
          <h3>{visitDate}</h3>
        </div>
        <button
          type="button"
          className="text-button visit-panel-close"
          aria-label="심방 신청 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <form className="visit-request-form" onSubmit={submit}>
        <fieldset>
          <legend>심방 유형</legend>
          <div className="visit-type-options">
            <label>
              <input
                type="radio"
                name="visitType"
                checked={visitType === "personal"}
                onChange={() => setVisitType("personal")}
              />
              개인심방
            </label>
            <label>
              <input
                type="radio"
                name="visitType"
                checked={visitType === "sam"}
                onChange={() => setVisitType("sam")}
              />
              샘심방
            </label>
          </div>
        </fieldset>

        <label>
          신청자
          <input value={requesterName} readOnly />
        </label>

        <label>
          참석자 명단
          <textarea
            required
            value={attendees}
            onChange={(event) => setAttendees(event.target.value)}
            placeholder="함께 참석하는 분의 이름을 적어주세요."
          />
        </label>

        <label>
          장소
          <input
            required
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="예: 가정, 교회, 카페"
          />
        </label>

        <label>
          희망 시간
          <input
            required
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            placeholder="예: 오후 3시 이후"
          />
        </label>

        <label>
          심방 요청 이유
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="심방을 요청하는 이유를 자유롭게 적어주세요."
          />
        </label>

        <p className="visit-confirmation-copy">
          신청한 내용을 확인 후 유선으로 확정합니다.
        </p>

        {message && (
          <p className={message.includes("전달") ? "success-text" : "error-text"} role="status">
            {message}
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={
            busy ||
            !attendees.trim() ||
            !location.trim() ||
            !preferredTime.trim() ||
            !reason.trim()
          }
        >
          {busy ? "신청 중…" : "확정"}
        </button>
      </form>
    </aside>
  );
}
