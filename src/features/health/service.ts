export type DatabaseHealthCode =
  | "DB_AUTH_FAILED"
  | "DB_DNS_FAILED"
  | "DB_TIMEOUT"
  | "DB_CONNECT_FAILED";

function validCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[A-Z0-9_]{2,64}$/.test(value) ? value : null;
}

export function safeDatabaseErrorDetails(error: unknown): {
  name: string | null;
  codes: string[];
} {
  if (typeof error !== "object" || error === null) {
    return { name: null, codes: [] };
  }

  const record = error as {
    name?: unknown;
    code?: unknown;
    cause?: { code?: unknown } | null;
    errors?: Array<{ code?: unknown }>;
  };

  const codes = new Set<string>();
  const direct = validCode(record.code);
  if (direct) codes.add(direct);

  const cause = validCode(record.cause?.code);
  if (cause) codes.add(cause);

  for (const nested of record.errors ?? []) {
    const code = validCode(nested?.code);
    if (code) codes.add(code);
  }

  return {
    name: typeof record.name === "string" ? record.name.slice(0, 80) : null,
    codes: [...codes],
  };
}

export function classifyDatabaseError(error: unknown): DatabaseHealthCode {
  const { codes } = safeDatabaseErrorDetails(error);

  if (codes.includes("28P01")) return "DB_AUTH_FAILED";
  if (codes.some((code) => code === "ENOTFOUND" || code === "EAI_AGAIN")) return "DB_DNS_FAILED";
  if (codes.some((code) => code === "ETIMEDOUT" || code === "ECONNRESET")) return "DB_TIMEOUT";
  return "DB_CONNECT_FAILED";
}
