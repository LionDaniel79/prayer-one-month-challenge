"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SessionHeartbeat() {
  const pathname = usePathname();
  if (pathname === "/about" || pathname === "/privacy") return null;
  return <ActiveSessionHeartbeat />;
}

function ActiveSessionHeartbeat() {
  useEffect(() => {
    void fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
  }, []);
  return null;
}
