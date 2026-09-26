import Link from "next/link";
import type { MemberNoticeSummary } from "../../src/features/notices/types";

function displayDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function NoticeList({
  notices,
}: {
  notices: MemberNoticeSummary[];
}) {
  if (notices.length === 0) {
    return (
      <section className="card empty-state">
        <strong>등록된 공지가 없습니다.</strong>
      </section>
    );
  }

  return (
    <section className="card notice-list" aria-label="공지 목록">
      {notices.map((notice) => (
        <Link
          className={notice.isUnread ? "notice-list-row is-unread" : "notice-list-row"}
          href={`/notices/${notice.id}`}
          key={notice.id}
        >
          <span className="notice-title-line">
            {notice.isUnread && <strong className="notice-new-badge">NEW</strong>}
            <strong>{notice.title}</strong>
          </span>
          <time dateTime={notice.publishedAt}>
            {displayDate(notice.publishedAt)}
          </time>
        </Link>
      ))}
    </section>
  );
}
