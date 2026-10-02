import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { prayerMenuSettings } from "../../db/prayer-menu-schema";

export type PrayerMenuSetting = { enabled: boolean };

export async function getPrayerMenuSettings(): Promise<PrayerMenuSetting> {
  const [row] = await getDb().select({ enabled: prayerMenuSettings.enabled })
    .from(prayerMenuSettings).where(eq(prayerMenuSettings.id, 1)).limit(1);
  return row ?? { enabled: true };
}

export async function savePrayerMenuSettings(enabled: boolean): Promise<PrayerMenuSetting> {
  const [row] = await getDb().insert(prayerMenuSettings).values({ id: 1, enabled })
    .onConflictDoUpdate({ target: prayerMenuSettings.id, set: { enabled, updatedAt: new Date() } })
    .returning({ enabled: prayerMenuSettings.enabled });
  if (!row) throw new Error("PRAYER_MENU_SAVE_FAILED");
  return row;
}
