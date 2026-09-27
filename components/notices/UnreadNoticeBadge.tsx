"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";

export function useUnreadNoticeCount() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;

    async function load() {
      if (loading || controller.signal.aborted || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const body = await fetchJson<{ count: number }>("/api/notices/unread-count", {
          cache: "no-store", signal: controller.signal,
        }, 5_000);
        if (!controller.signal.aborted && Number.isInteger(body.count) && body.count >= 0) setCount(body.count);
      } catch {
        // App-internal notices remain usable even if the badge request fails.
      } finally {
        loading = false;
      }
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
  }, [pathname]);

  return count;
}

export function UnreadNoticeBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="nav-badge" aria-label={`안 읽은 공지 ${count}개`}>
      !
    </span>
  );
}
