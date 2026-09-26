"use client";

import type {
  AdminPrayerRequestSummary,
  PrayerRequestStatus,
} from "../../../src/features/prayer-requests/types";

function statusLabel(status: PrayerRequestStatus) {
  if (status === "praying") return "기도중";
  if (status === "completed") return "완료";
  return "접수";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export function AdminPrayerRequestList({
  requests,
  filter,
  selectedId,
  onFilterChange,
  onSelect,
}: {
  requests: AdminPrayerRequestSummary[];
  filter: "all" | PrayerRequestStatus;
  selectedId: string | null;
  onFilterChange: (value: "all" | PrayerRequestStatus) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="card admin-prayer-request-list">
      <div className="section-heading">
        <h2>요청 목록</h2>
        <select
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as "all" | PrayerRequestStatus)
          }
          aria-label="기도요청 상태 필터"
        >
          <option value="all">전체</option>
          <option value="received">접수</option>
          <option value="praying">기도중</option>
          <option value="completed">완료</option>
        </select>
      </div>

      <div className="admin-request-columns admin-request-columns-head">
        <span>요청자</span>
        <span>요청일</span>
        <span>상태</span>
      </div>

      {requests.length === 0 ? (
        <p className="helper-text">해당 상태의 기도요청이 없습니다.</p>
      ) : (
        <div className="admin-request-rows">
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              className={
                selectedId === request.id
                  ? "admin-request-row is-selected"
                  : "admin-request-row"
              }
              onClick={() => onSelect(request.id)}
            >
              <span><strong>{request.requesterName}</strong><small>{request.preview}</small></span>
              <span>{dateLabel(request.createdAt)}</span>
              <span>{statusLabel(request.status)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
