export type PrayerMenuSetting = { enabled: boolean; name: string; description: string };

export const defaultPrayerMenuSettings: PrayerMenuSetting = {
  enabled: true,
  name: "기도운동",
  description: "",
};

export function isPrayerMenuSetting(value: unknown): value is PrayerMenuSetting {
  if (!value || typeof value !== "object") return false;
  const setting = value as Partial<PrayerMenuSetting>;
  return typeof setting.enabled === "boolean" && typeof setting.name === "string" &&
    setting.name.trim().length > 0 && typeof setting.description === "string";
}
