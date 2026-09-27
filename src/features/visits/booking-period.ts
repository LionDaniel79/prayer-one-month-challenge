import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { visitBookingSettings } from "../../db/schema";

export const BookingPeriodInput = z.object({
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
}).refine(({ startDate, endDate }) =>
  (startDate === null && endDate === null) ||
  (startDate !== null && endDate !== null && startDate <= endDate),
);

export type BookingPeriod = z.infer<typeof BookingPeriodInput>;

export function withinBookingPeriod(date: string, period: BookingPeriod): boolean {
  return (!period.startDate || date >= period.startDate) &&
    (!period.endDate || date <= period.endDate);
}

export async function getBookingPeriod(): Promise<BookingPeriod> {
  const [row] = await getDb().select({ startDate: visitBookingSettings.startDate, endDate: visitBookingSettings.endDate })
    .from(visitBookingSettings).where(eq(visitBookingSettings.id, 1)).limit(1);
  return row ?? { startDate: null, endDate: null };
}

export async function saveBookingPeriod(period: BookingPeriod): Promise<void> {
  const values = BookingPeriodInput.parse(period);
  await getDb().insert(visitBookingSettings).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: visitBookingSettings.id, set: { ...values, updatedAt: new Date() } });
}
