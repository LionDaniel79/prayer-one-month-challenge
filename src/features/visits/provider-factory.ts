import { DomainError } from "../../lib/http";
import type { CalendarProvider } from "./calendar-provider";

export async function getSelectedCalendarProvider(): Promise<CalendarProvider> {
  throw new DomainError("CALENDAR_NOT_CONNECTED", 409);
}
