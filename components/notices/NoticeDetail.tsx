import Link from "next/link";
import type { MemberNoticeDetail } from "../../src/features/notices/types";

function displayDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function NoticeDetail({ notice }: { notice: MemberNoticeDetail }) {
  return (
    <article className="card notice-detail">
      <div className="notice-detail-heading">
        <div>
          <p className="eyebrow">공지</p>
          <h2>{notice.title}</h2>
          <time dateTime={notice.publishedAt}>{displayDate(notice.publishedAt)}</time>
        </div>
        <Link href="/notices" className="text-link">목록으로</Link>
      </div>
      <div className="notice-body">{notice.body}</div>
    </article>
  );
}
