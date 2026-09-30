import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../auth/http-session";
import { ReportError, checkOrigin, readLimited, readReportJson, type Actor } from "./policy";
export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie", "Referrer-Policy": "no-referrer" };
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: privateHeaders }); }
export async function sessionActor(): Promise<Actor> {
  const actor = await getCurrentSessionUser();
  if (!actor) throw new ReportError("UNAUTHORIZED", 401);
  return actor;
}
export const sameOrigin = checkOrigin;
export async function boundedBytes(request: Request, limit: number): Promise<Buffer> { return Buffer.from(await readLimited(request, limit)); }
export const boundedJson = readReportJson;
export async function requireAdminActor(): Promise<Actor> {
  const actor = await getCurrentSessionUser();
  // Match the existing application's admin boundary: unauthenticated is FORBIDDEN.
  if (!actor || actor.role !== "admin") throw new ReportError("FORBIDDEN", 403);
  return actor;
}
export function errorResponse(error: unknown) {
  if (error instanceof ReportError) return json({ code: error.code }, error.status);
  // Never send SQL errors, report text, filenames, phone data or stack traces to clients/logs.
  return json({ code: "PASTORAL_UNAVAILABLE" }, 503);
}
export function binary(bytes: Buffer, contentType = "application/octet-stream") {
  return new NextResponse(Uint8Array.from(bytes), { headers: { ...privateHeaders, "Content-Type": contentType } });
}
