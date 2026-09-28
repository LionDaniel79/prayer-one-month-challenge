"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    void fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
  }, []);
  return null;
}
