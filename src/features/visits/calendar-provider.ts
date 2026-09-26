import type { CalendarEventLike } from "./types";

export type VisitCalendarEventInput = {
  requesterName: string;
  visitDate: string;
  visitType: "personal" | "sam";
  attendees: string;
  location: string;
  preferredTime: string;
  status?: "requested" | "confirmed" | "completed";
};

export interface CalendarProvider {
  listEvents(input: {
    timeMin: string;
    timeMax: string;
  }): Promise<CalendarEventLike[]>;

  createVisitEvent(
    input: VisitCalendarEventInput,
  ): Promise<{ eventId: string }>;

  updateVisitEvent(
    eventId: string,
    input: VisitCalendarEventInput,
  ): Promise<void>;

  deleteVisitEvent(eventId: string): Promise<void>;
}
