import { z } from "zod";
import { getCurrentSessionUser } from "../auth/http-session";
import { json } from "../pastoral/http";
import { ReportError } from "../pastoral/policy";
import { DomainError } from "../../lib/http";

export { json, sameOrigin, boundedJson } from "../pastoral/http";
export async function prayerActor() {
  const user = await getCurrentSessionUser();
  if (!user) throw new DomainError("UNAUTHORIZED", 401);
  return user;
}
export async function prayerId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) throw new DomainError("INVALID_INPUT", 400);
  return id;
}
export function prayerError(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) return json({ code: error.code }, error.status);
  return json({ code: "PRAYER_REQUEST_UNAVAILABLE" }, 503);
}
