export type VisitStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled";

export type CalendarSyncStatus = "pending" | "synced" | "failed";

export type CalendarEventLike = {
  status?: string | null;
  start?: {
    date?: string | null;
    dateTime?: string | null;
  } | null;
  end?: {
    date?: string | null;
    dateTime?: string | null;
  } | null;
};

export type VisitUnavailableReason =
  | "past_date"
  | "calendar_unavailable"
  | "google_event"
  | "blocked_date"
  | "blocked_weekday"
  | "existing_visit";

export type VisitDateAvailability =
  | { date: string; available: true }
  | {
      date: string;
      available: false;
      reason: VisitUnavailableReason;
    };
