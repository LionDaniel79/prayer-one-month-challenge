/** Shared validation only: safe to import into both browser and server. */
export const MAX_FILE_BYTES = 6 * 1024 * 1024;
export const CHUNK_BYTES = 512 * 1024;
export const PAGE_SIZE = 20;
export type Actor = { id: string; role: string };
export type FileInput = { name: string; size: number; sha256: string };
export class CommunityError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw new CommunityError("INVALID_INPUT");
  return value.toLowerCase();
}
export function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.includes("\0")) throw new CommunityError("INVALID_INPUT");
  const result = value.normalize("NFC").trim();
  if (!result || result.length > max) throw new CommunityError("INVALID_INPUT");
  return result;
}
export const parseFolderName = (value: unknown) => text(value, 60);
export const parseCommentBody = (value: unknown) => text(value, 2000);
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommunityError("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export function validateFiles(value: unknown): FileInput[] {
  if (!Array.isArray(value)) throw new CommunityError("INVALID_INPUT");
  if (value.length > 2) throw new CommunityError("TOO_MANY_FILES");
  return value.map(item => {
    const file = record(item);
    const name = text(file.name, 180);
    if (/[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name) || name.startsWith(".") || name.endsWith(".")) throw new CommunityError("INVALID_FILENAME");
    if (/\.(exe|dll|msi|bat|cmd|com|scr|ps1|vbs|js|mjs|html?|svg|sh|jar|apk|lnk|url|reg)$/i.test(name)) throw new CommunityError("UNSUPPORTED_FILE");
    if (typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 1) throw new CommunityError("INVALID_FILE_SIZE");
    if (file.size > MAX_FILE_BYTES) throw new CommunityError("FILE_TOO_LARGE", 413);
    if (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(file.sha256)) throw new CommunityError("INVALID_INPUT");
    return { name, size: file.size, sha256: file.sha256.toLowerCase() };
  });
}
export function expectedChunkSize(size: number, index: number): number {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES || !Number.isSafeInteger(index) || index < 0 || index >= Math.ceil(size / CHUNK_BYTES)) throw new CommunityError("INVALID_CHUNK");
  return Math.min(CHUNK_BYTES, size - index * CHUNK_BYTES);
}
export function assertManager(user: Actor): void {
  if (user.role !== "admin") throw new CommunityError("FORBIDDEN", 403);
}
export function assertEditor(user: Actor, authorId: string | null): void {
  if (user.role !== "admin" && user.id !== authorId) throw new CommunityError("FORBIDDEN", 403);
}
export function parsePostInput(value: unknown) {
  const input = record(value);
  return { id: uuid(input.id), folderId: uuid(input.folderId), title: text(input.title, 150), body: text(input.body, 20000), files: validateFiles(input.files ?? []) };
}
export function pageNumber(value: unknown): number {
  if (value == null || value === "") return 1;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > 100000) throw new CommunityError("INVALID_INPUT");
  return result;
}
export function parseLikeInput(value: unknown): boolean {
  const input = record(value);
  if (typeof input.liked !== "boolean") throw new CommunityError("INVALID_INPUT");
  return input.liked;
}
