"use client";

import type { AdminVisitRecord } from "../../../src/features/visits/admin-service";
import type { VisitStatus } from "../../../src/features/visits/types";

function statusLabel(status: VisitStatus) {
  if (status === "confirmed") return "확정";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";
  return "신청됨";
}

export function AdminVisitList({
  visits,
  selectedId,
  status,
  from,
  to,
  onStatusChange,
  onFromChange,
  onToChange,
  onSearch,
  onSelect,
}: {
  visits: AdminVisitRecord[];
  selectedId: string | null;
  status: "all" | VisitStatus;
  from: string;
  to: string;
  onStatusChange: (value: "all" | VisitStatus) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (visit: AdminVisitRecord) => void;
}) {
  return (
    <section className="card admin-visit-list">
      <div className="section-heading">
        <div>
          <h2>심방 신청</h2>
          <p className="helper-text">상태와 날짜로 신청 내역을 확인합니다.</p>
        </div>
        <button className="text-button" type="button" onClick={onSearch}>
          조회
        </button>
      </div>

      <div className="admin-visit-filters">
        <label>
          상태
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as "all" | VisitStatus)
            }
          >
            <option value="all">전체</option>
            <option value="requested">신청됨</option>
            <option value="confirmed">확정</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>
        </label>
        <label>
          시작일
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>
      </div>

      {visits.length === 0 ? (
        <p className="helper-text">조건에 맞는 심방 신청이 없습니다.</p>
      ) : (
        <div className="admin-visit-rows">
          {visits.map((visit) => (
            <button
              key={visit.id}
              type="button"
              className={
                selectedId === visit.id
                  ? "admin-visit-row is-selected"
                  : "admin-visit-row"
              }
              onClick={() => onSelect(visit)}
            >
              <span>
                <strong>{visit.requesterName}</strong>
                <small>
                  {visit.visitType === "sam" ? "샘심방" : "개인심방"}
                </small>
              </span>
              <span>{visit.visitDate}</span>
              <span>{statusLabel(visit.status)}</span>
              <span>{visit.calendarSyncStatus === "synced" ? "동기화됨" : "동기화 " + visit.calendarSyncStatus}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
