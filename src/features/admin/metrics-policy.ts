/** UI/HTTP metric rules. Login activity is independent from permission to log in. */
export const ACTIVITY_PAGE_SIZE = 10;
export function hasLoginHistory(firstLoginAt: Date | string | null | undefined): boolean {
  return firstLoginAt != null;
}
export function parseActivityPage(value: string | null): number {
  if (value === null) return 1;
  if (!/^[1-9]\d{0,5}$/.test(value) || Number(value) > 100000) throw new Error("INVALID_PAGE");
  return Number(value);
}
export function activityPagination(requested: number, total: number) {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 100000) throw new Error("INVALID_PAGE");
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / ACTIVITY_PAGE_SIZE));
  const page = Math.min(requested, pages);
  return { page, pages, total, pageSize: ACTIVITY_PAGE_SIZE, offset: (page - 1) * ACTIVITY_PAGE_SIZE };
}
export function reviewPending(submittedAt: string | null, version: number, reviewedVersion: number) {
  return submittedAt !== null && reviewedVersion < version;
}
