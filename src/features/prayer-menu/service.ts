import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { prayerMenuSettings } from "../../db/prayer-menu-schema";
import { defaultPrayerMenuSettings, type PrayerMenuSetting } from "./settings";

export type { PrayerMenuSetting } from "./settings";

const selection = { enabled: prayerMenuSettings.enabled, name: prayerMenuSettings.name, description: prayerMenuSettings.description };

export async function getPrayerMenuSettings(): Promise<PrayerMenuSetting> {
  const [row] = await getDb().select(selection)
    .from(prayerMenuSettings).where(eq(prayerMenuSettings.id, 1)).limit(1);
  return row ?? { ...defaultPrayerMenuSettings };
}

export async function savePrayerMenuSettings(input: { enabled: boolean; name?: string; description?: string }): Promise<PrayerMenuSetting> {
  const [row] = await getDb().insert(prayerMenuSettings).values({ id: 1, ...input })
    .onConflictDoUpdate({ target: prayerMenuSettings.id, set: { ...input, updatedAt: new Date() } })
    .returning(selection);
  if (!row) throw new Error("PRAYER_MENU_SAVE_FAILED");
  return row;
}
