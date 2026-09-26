import "server-only";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE_NAME } from "./session";

export async function getCurrentSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? getSessionUser(token) : null;
}
