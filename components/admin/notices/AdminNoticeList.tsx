"use client";

import type { AdminNoticeRow, NoticeStatus } from "../../../src/features/notices/types";

export function AdminNoticeList({
  notices,
  filter,
  onFilterChange,
  onEdit,
  onDelete,
}: {
  notices: AdminNoticeRow[];
  filter: "all" | NoticeStatus;
  onFilterChange: (value: "all" | NoticeStatus) => void;
  onEdit: (notice: AdminNoticeRow) => void;
  onDelete: (notice: AdminNoticeRow) => void;
}) {
  const filtered =
    filter === "all"
      ? notices
      : notices.filter((notice) => notice.status === filter);

  return (
    <section className="card admin-section">
      <div className="section-heading">
        <h2>공지 목록</h2>
        <select
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as "all" | NoticeStatus)
          }
          aria-label="공지 상태 필터"
        >
          <option value="all">전체</option>
          <option value="draft">임시저장</option>
          <option value="published">발행됨</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="helper-text">해당 상태의 공지가 없습니다.</p>
      ) : (
        <div className="admin-notice-list">
          {filtered.map((notice) => (
            <article className="admin-notice-row" key={notice.id}>
              <div>
                <div className="admin-notice-title-line">
                  <strong>{notice.title}</strong>
                  <span className={notice.status === "published" ? "status-pill is-success" : "status-pill"}>
                    {notice.status === "published" ? "발행됨" : "임시저장"}
                  </span>
                </div>
                <p className="helper-text">
                  {notice.status === "published"
                    ? "읽음 " + notice.readCount + " / " + notice.targetActiveUsers
                    : "아직 사용자에게 공개되지 않았습니다."}
                </p>
              </div>
              <div className="header-actions">
                <button className="text-button" type="button" onClick={() => onEdit(notice)}>
                  수정
                </button>
                <button className="text-button danger-button" type="button" onClick={() => onDelete(notice)}>
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
