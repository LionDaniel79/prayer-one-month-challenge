export type NoticeStatus = "draft" | "published";

export type MemberNoticeSummary = {
  id: string;
  title: string;
  publishedAt: string;
  isUnread: boolean;
};

export type MemberNoticeDetail = MemberNoticeSummary & {
  body: string;
};

export type AdminNoticeInput = {
  title: string;
  body: string;
  status: NoticeStatus;
};

export type AdminNoticeRow = {
  id: string;
  title: string;
  body: string;
  status: NoticeStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readCount: number;
  targetActiveUsers: number;
};
