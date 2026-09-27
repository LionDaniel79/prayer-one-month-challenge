export function normalizeSamLabel(value: string | null | undefined): string | null {
  const label = (value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(/마을-?/g, "-")
    .replace(/샘$/, "");
  if (!label) return null;
  return label.split("-").map((part) => /^\d+$/.test(part) ? String(Number(part)) : part).join("-");
}

export function normalizeSamLeaderName(value: string): string {
  return value.trim().normalize("NFC").replace(/\s+/g, " ")
    .replace(/\s*(?:\(|\[)?(?:담임목사|부목사|목사|전도사|장로|권사|안수집사|집사|성도)(?:님)?(?:\)|\])?$/, "")
    .trim();
}
