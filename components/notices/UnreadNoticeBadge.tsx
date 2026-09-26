"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function UnreadNoticeBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/notices/unread-count", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = await response.json().catch(() => ({}));
        if (!cancelled) setCount(Number(body.count ?? 0));
      } catch {
        // App-internal notices remain usable even if the badge request fails.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (count <= 0) return null;

  return (
    <span className="nav-badge" aria-label={`안 읽은 공지 ${count}개`}>
      {count}
    </span>
  );
}
