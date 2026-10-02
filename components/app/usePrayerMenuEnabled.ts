"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";
import type { PrayerMenuSetting } from "../../src/features/prayer-menu/service";

export function usePrayerMenuEnabled(initialEnabled: boolean, menuOpen: boolean) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(initialEnabled);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function load() {
      if (loading || controller.signal.aborted || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const setting = await fetchJson<PrayerMenuSetting>("/api/prayer-menu", {
          cache: "no-store", signal: controller.signal,
        }, 5_000);
        if (!controller.signal.aborted && typeof setting.enabled === "boolean") setEnabled(setting.enabled);
      } catch {
        // A temporary failure must not override the last known global setting.
      } finally { loading = false; }
    }
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname, menuOpen]);

  return enabled;
}
