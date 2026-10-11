"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";

export const prayerCommentsReadEvent = "prayer-comments:read";

export function useUnreadPrayerComments(menuOpen: boolean) {
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    let refreshAgain = false;
    async function refresh() {
      if (controller.signal.aborted || document.visibilityState === "hidden") return;
      if (loading) { refreshAgain = true; return; }
      loading = true;
      try {
        const body = await fetchJson<{ hasUnread: boolean }>("/api/prayer-requests/unread", {
          cache: "no-store", signal: controller.signal,
        }, 5000);
        // A read acknowledgement during this request requires a fresh result.
        if (!controller.signal.aborted && !refreshAgain && typeof body.hasUnread === "boolean") setHasUnread(body.hasUnread);
      } catch { /* Keep the last known badge during a temporary network failure. */ }
      finally {
        loading = false;
        if (refreshAgain) { refreshAgain = false; void refresh(); }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener(prayerCommentsReadEvent, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(prayerCommentsReadEvent, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname, menuOpen]);
  return hasUnread;
}
