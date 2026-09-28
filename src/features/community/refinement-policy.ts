import { CommunityError, record, text, uuid, validateFiles, type Actor } from "./policy";
export function assertAuthor(user: Actor, authorId: string | null) {
  if (user.id !== authorId) throw new CommunityError("FORBIDDEN", 403);
}
export function parseFolderOrder(value: unknown) {
  const input = record(value);
  function ids(value: unknown): string[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 1000) throw new CommunityError("INVALID_INPUT");
    const result = value.map(uuid);
    if (new Set(result).size !== result.length) throw new CommunityError("INVALID_INPUT");
    return result;
  }
  const ordered = ids(input.ids), expected = ids(input.expectedIds);
  if (ordered.length !== expected.length || ordered.some(id => !expected.includes(id))) throw new CommunityError("INVALID_INPUT");
  return { ids: ordered, expectedIds: expected };
}
export function parseEditInput(value: unknown) {
  const input = record(value);
  if (!Number.isSafeInteger(input.baseVersion) || (input.baseVersion as number) < 0) throw new CommunityError("INVALID_INPUT");
  if (!Array.isArray(input.keepSlots) || input.keepSlots.some(slot => slot !== 0 && slot !== 1) || new Set(input.keepSlots).size !== input.keepSlots.length) throw new CommunityError("INVALID_INPUT");
  const files = validateFiles(input.files);
  if (files.length + input.keepSlots.length > 2) throw new CommunityError("TOO_MANY_FILES");
  return { id: uuid(input.id), baseVersion: input.baseVersion as number, title: text(input.title, 150), body: text(input.body, 20000), keepSlots: [...input.keepSlots].sort() as number[], files };
}
export type EditInput = ReturnType<typeof parseEditInput>;
export const isPhotoName = (name: string) => /\.(jpe?g|png|webp|gif|avif|tiff?|heic|heif)$/i.test(name);
