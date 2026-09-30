"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "./client";
export function usePastoralBadge() {
  const path = usePathname();
  const [status, setStatus] = useState({ visible: false, count: 0 });
  useEffect(() => {
    const controller = new AbortController(); let busy = false;
    async function refresh() {
      if (busy || controller.signal.aborted || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const value = await api<{ visible: boolean; count: number }>("/api/pastoral/status", { cache: "no-store", signal: controller.signal }, 8000);
        if (!controller.signal.aborted) setStatus({ visible: value.visible === true, count: Number.isInteger(value.count) && value.count > 0 ? value.count : 0 });
      } catch { /* Hide initially; temporary errors do not erase an existing reminder. */ }
      finally { busy = false; }
    }
    void refresh(); const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh); window.addEventListener("pastoral:changed", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pastoral:changed", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [path]);
  return status;
}
export function ReportBadge({ count }: { count: number }) {
  return count > 0 ? <span className="nav-badge" aria-label={`미제출 목양지 ${count}건`}>!</span> : null;
}
