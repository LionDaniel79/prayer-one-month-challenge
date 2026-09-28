import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE_NAME } from "./session";

// Request-local only: layouts and pages share a read, never another user's session.
export const getCurrentSessionUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? getSessionUser(token) : null;
});
