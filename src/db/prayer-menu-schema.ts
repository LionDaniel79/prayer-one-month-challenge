import { boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { appSchema } from "./schema";

// One application-wide flag, independent of challenge activation and user roles.
export const prayerMenuSettings = appSchema.table("prayer_menu_settings", {
  id: integer("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
