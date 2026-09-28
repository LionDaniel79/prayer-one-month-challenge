export type PrayerRequestStatus = "received" | "praying" | "completed";

export type AdminPrayerRequestSummary = {
  id: string;
  requesterName: string;
  createdAt: string;
  status: PrayerRequestStatus;
  preview: string;
};

export type AdminPrayerRequestDetail = AdminPrayerRequestSummary & {
  content: string;
};
