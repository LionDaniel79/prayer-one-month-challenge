import { addDays } from "../challenge/date";
import type {
  CalendarProvider,
  VisitCalendarEventInput,
} from "../visits/calendar-provider";
import type { CalendarEventLike } from "../visits/types";

type CalendarResponse<T> = Promise<{ data: T }>;

export type CalendarClientLike = {
  events: {
    list(args: Record<string, unknown>): CalendarResponse<{
      items?: Array<{
        status?: string | null;
        start?: { date?: string | null; dateTime?: string | null } | null;
        end?: { date?: string | null; dateTime?: string | null } | null;
      }>;
      nextPageToken?: string | null;
    }>;
    insert(args: Record<string, unknown>): CalendarResponse<{ id?: string | null }>;
    update(args: Record<string, unknown>): CalendarResponse<unknown>;
    delete(args: Record<string, unknown>): CalendarResponse<unknown>;
  };
};

function typeLabel(value: "personal" | "sam"): string {
  return value === "personal" ? "개인심방" : "샘심방";
}

function summary(input: VisitCalendarEventInput): string {
  const state =
    input.status === "confirmed"
      ? " 확정"
      : input.status === "completed"
        ? " 완료"
        : "";
  return `[56사랑 심방${state}] ${input.requesterName} - ${typeLabel(input.visitType)}`;
}

function requestBody(input: VisitCalendarEventInput) {
  return {
    summary: summary(input),
    start: { date: input.visitDate },
    end: { date: addDays(input.visitDate, 1) },
    description: [
      "신청자: " + input.requesterName,
      "심방 유형: " + typeLabel(input.visitType),
      "장소: " + input.location,
      "희망 시간: " + input.preferredTime,
      "참석자 명단: " + input.attendees,
    ].join("\n"),
  };
}

export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly calendar: CalendarClientLike,
    private readonly calendarId: string,
  ) {}

  async listEvents(input: {
    timeMin: string;
    timeMax: string;
  }): Promise<CalendarEventLike[]> {
    const events: CalendarEventLike[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        singleEvents: true,
        showDeleted: false,
        pageToken,
      });

      for (const item of response.data.items ?? []) {
        events.push({
          status: item.status ?? null,
          start: item.start ?? null,
          end: item.end ?? null,
        });
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return events;
  }

  async createVisitEvent(
    input: VisitCalendarEventInput,
  ): Promise<{ eventId: string }> {
    const response = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: requestBody(input),
    });

    const eventId = response.data.id;
    if (!eventId) throw new Error("GOOGLE_EVENT_ID_MISSING");
    return { eventId };
  }

  async updateVisitEvent(
    eventId: string,
    input: VisitCalendarEventInput,
  ): Promise<void> {
    await this.calendar.events.update({
      calendarId: this.calendarId,
      eventId,
      requestBody: requestBody(input),
    });
  }

  async deleteVisitEvent(eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId: this.calendarId,
      eventId,
    });
  }
}
