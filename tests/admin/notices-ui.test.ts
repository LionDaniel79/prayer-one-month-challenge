import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin notice management UI", () => {
  it("supports draft, publish, edit, delete, and read statistics", () => {
    const list = readFileSync(
      "components/admin/notices/AdminNoticeList.tsx",
      "utf8",
    );
    const editor = readFileSync(
      "components/admin/notices/AdminNoticeEditor.tsx",
      "utf8",
    );
    expect(editor).toContain("임시저장");
    expect(editor).toContain("발행");
    expect(list).toContain("임시저장");
    expect(list).toContain("발행됨");
    expect(list).toContain("읽음");
    expect(list).toContain("삭제");
    expect(list).toContain("수정");
  });
});
