export function canonicalizeRosterName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").normalize("NFC");
  if (!normalized) throw new Error("INVALID_NAME");

  const suffix = normalized.match(/^(.+[가-힣])\s*[A-Za-z]+$/u);
  return (suffix?.[1] ?? normalized).trim();
}

export function normalizeRosterPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{9,11}$/.test(digits)) throw new Error("INVALID_PHONE");
  return digits;
}

export function normalizeOptionalPhone(value: string): string | null {
  if (!value.trim()) return null;
  return normalizeRosterPhone(value);
}

export function formatPhoneForDisplay(value: string): string {
  const digits = normalizeRosterPhone(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function trimSuffix(value: string, suffix: string): string | null {
  const normalized = value.trim().replace(/\s+/g, "").normalize("NFC");
  if (!normalized) return null;
  const stripped = normalized.endsWith(suffix)
    ? normalized.slice(0, -suffix.length)
    : normalized;
  return stripped || null;
}

export function normalizeVillage(value: string): string | null {
  return trimSuffix(value, "마을");
}

export function normalizeSam(value: string): string | null {
  return trimSuffix(value, "샘");
}

export function makeSamLabel(
  villageValue: string | null,
  samValue: string | null,
): string | null {
  if (!villageValue || !samValue) return null;
  const village = normalizeVillage(villageValue);
  const sam = normalizeSam(samValue);
  return village && sam ? `${village}-${sam}` : null;
}
