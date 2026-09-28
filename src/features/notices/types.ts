export type NoticeStatus = "draft" | "published";

export type MemberNoticeSummary = {
  id: string;
  title: string;
  publishedAt: string;
  isUnread: boolean;
};

export type MemberNoticeDetail = MemberNoticeSummary & {
  body: string;
  image: NoticeImage | null;
};

export type NoticeImage = { url: string; width: number; height: number };

export type AdminNoticeInput = {
  title: string;
  body: string;
  status: NoticeStatus;
  image?: import("./image").NoticeImageUpload | null;
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
  image: NoticeImage | null;
};
