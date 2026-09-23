export type DatabaseHealthCode =
  | "DB_AUTH_FAILED"
  | "DB_DNS_FAILED"
  | "DB_TIMEOUT"
  | "DB_CONNECT_FAILED";

export function classifyDatabaseError(error: unknown): DatabaseHealthCode {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";

  if (code === "28P01") return "DB_AUTH_FAILED";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DB_DNS_FAILED";
  if (code === "ETIMEDOUT" || code === "ECONNRESET") return "DB_TIMEOUT";
  return "DB_CONNECT_FAILED";
}
