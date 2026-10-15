"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";
import { defaultPrayerMenuSettings, isPrayerMenuSetting, type PrayerMenuSetting } from "../../src/features/prayer-menu/settings";

const PrayerMenuContext = createContext(defaultPrayerMenuSettings);

export function usePrayerMenuSettings() { return useContext(PrayerMenuContext); }

export function PrayerMenuProvider({ initial, menuOpen, children }: {
  initial: PrayerMenuSetting;
  menuOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [setting, setSetting] = useState(initial);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    let version = 0;
    async function load() {
      if (loading || controller.signal.aborted || document.visibilityState === "hidden") return;
      loading = true;
      const requestVersion = ++version;
      try {
        const next = await fetchJson<unknown>("/api/prayer-menu", { cache: "no-store", signal: controller.signal }, 5_000);
        if (!controller.signal.aborted && requestVersion === version && isPrayerMenuSetting(next)) setSetting(next);
      } catch {
        // Retain the last confirmed setting on a temporary failure.
      } finally { loading = false; }
    }
    function changed(event: Event) {
      const next = (event as CustomEvent<unknown>).detail;
      if (isPrayerMenuSetting(next)) { version++; setSetting(next); }
    }
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    window.addEventListener("prayer-menu:changed", changed);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      window.removeEventListener("prayer-menu:changed", changed);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname, menuOpen]);
  return <PrayerMenuContext.Provider value={setting}>{children}</PrayerMenuContext.Provider>;
}
