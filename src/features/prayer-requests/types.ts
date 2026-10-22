export type PrayerRequestStatus = "received" | "praying" | "completed";
export type AdminPrayerRequestFilter = "all" | "unread" | PrayerRequestStatus;

export type AdminPrayerRequestSummary = {
  id: string;
  requesterName: string;
  createdAt: string;
  status: PrayerRequestStatus;
  preview: string;
  hasUnreadComments: boolean;
  completedByRequester?: boolean;
  completedAt?: string | null;
};

export type OwnPrayerRequest = {
  id: string;
  content: string;
  status: PrayerRequestStatus;
  createdAt: string;
  version: number;
  completedByRequester: boolean;
  hasUnreadComments: boolean;
};

export type PrayerComment = {
  id: string;
  content: string;
  version: number;
  editedAt: string | null;
  authorName: string;
  authorRole: "member" | "admin";
  isOwn: boolean;
  sequence: number;
  createdAt: string;
};

export type PrayerCommentPage = {
  comments: PrayerComment[];
  hasMore: boolean;
};

export type AdminPrayerRequestDetail = AdminPrayerRequestSummary & {
  content: string;
};
