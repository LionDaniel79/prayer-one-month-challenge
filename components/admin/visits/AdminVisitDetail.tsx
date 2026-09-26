"use client";

import { useState } from "react";
import type {
  AdminVisitRecord,
  VisitDetailPatch,
} from "../../../src/features/visits/admin-service";

export function AdminVisitDetail({
  visit,
  busy,
  onSave,
  onAction,
}: {
  visit: AdminVisitRecord | null;
  busy: boolean;
  onSave: (patch: VisitDetailPatch) => Promise<void>;
  onAction: (action: "confirm" | "complete" | "cancel") => Promise<void>;
}) {
  const [visitType, setVisitType] = useState<"personal" | "sam">(
    visit?.visitType ?? "personal",
  );
  const [attendees, setAttendees] = useState(visit?.attendees ?? "");
  const [location, setLocation] = useState(visit?.location ?? "");
  const [preferredTime, setPreferredTime] = useState(visit?.preferredTime ?? "");
  const [reason, setReason] = useState(visit?.reason ?? "");

  if (!visit) {
    return (
      <section className="card empty-state admin-visit-detail">
        <strong>심방 신청을 선택해 주세요.</strong>
      </section>
    );
  }

  const syncLabel =
    visit.calendarSyncStatus === "synced"
      ? "Google Calendar 동기화됨"
      : visit.calendarSyncStatus === "failed"
        ? "Google Calendar 동기화 실패"
        : "Google Calendar 동기화 대기";

  return (
    <section className="card admin-visit-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">신청 상세</p>
          <h2>{visit.requesterName}</h2>
        </div>
        <span
          className={
            visit.calendarSyncStatus === "failed"
              ? "status-pill danger-button"
              : "status-pill is-success"
          }
        >
          {syncLabel}
        </span>
      </div>

      <dl className="admin-visit-summary">
        <div><dt>신청 날짜</dt><dd>{visit.visitDate}</dd></div>
        <div><dt>상태</dt><dd>{visit.status}</dd></div>
      </dl>

      <div className="admin-form">
        <label>
          심방 유형
          <select
            value={visitType}
            onChange={(event) =>
              setVisitType(event.target.value as "personal" | "sam")
            }
            disabled={busy || visit.status === "cancelled"}
          >
            <option value="personal">개인심방</option>
            <option value="sam">샘심방</option>
          </select>
        </label>
        <label>
          참석자 명단
          <textarea
            value={attendees}
            onChange={(event) => setAttendees(event.target.value)}
            disabled={busy || visit.status === "cancelled"}
          />
        </label>
        <label>
          장소
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={busy || visit.status === "cancelled"}
          />
        </label>
        <label>
          희망 시간
          <input
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            disabled={busy || visit.status === "cancelled"}
          />
        </label>
        <label>
          심방 요청 이유
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || visit.status === "cancelled"}
          />
        </label>
      </div>

      {visit.status !== "cancelled" && (
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() =>
            void onSave({
              visitType,
              attendees,
              location,
              preferredTime,
              reason,
            })
          }
        >
          수정 내용 저장
        </button>
      )}

      <div className="admin-visit-actions">
        {visit.status === "requested" && (
          <button
            className="primary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("confirm")}
          >
            유선확정 완료
          </button>
        )}
        {visit.status === "confirmed" && (
          <button
            className="primary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("complete")}
          >
            완료
          </button>
        )}
        {(visit.status === "requested" || visit.status === "confirmed") && (
          <button
            className="text-button danger-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("cancel")}
          >
            취소
          </button>
        )}
      </div>
    </section>
  );
}
