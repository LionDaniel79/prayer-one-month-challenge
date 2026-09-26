"use client";

import type {
  AdminPrayerRequestDetail,
  PrayerRequestStatus,
} from "../../../src/features/prayer-requests/types";

const actions: Array<{ status: PrayerRequestStatus; label: string }> = [
  { status: "received", label: "접수" },
  { status: "praying", label: "기도중" },
  { status: "completed", label: "완료" },
];

export function AdminPrayerRequestDetail({
  request,
  busy,
  onStatusChange,
}: {
  request: AdminPrayerRequestDetail | null;
  busy: boolean;
  onStatusChange: (status: PrayerRequestStatus) => void;
}) {
  if (!request) {
    return (
      <section className="card empty-state admin-request-detail">
        <strong>기도요청을 선택해 주세요.</strong>
      </section>
    );
  }

  return (
    <section className="card admin-request-detail">
      <div>
        <p className="eyebrow">요청자</p>
        <h2>{request.requesterName}</h2>
      </div>

      <div className="admin-request-content">
        <p>{request.content}</p>
      </div>

      <div>
        <p className="helper-text">처리 상태</p>
        <div className="admin-request-actions">
          {actions.map((action) => (
            <button
              key={action.status}
              type="button"
              className={
                request.status === action.status
                  ? "primary-button compact-button"
                  : "text-button"
              }
              disabled={busy || request.status === action.status}
              onClick={() => onStatusChange(action.status)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
