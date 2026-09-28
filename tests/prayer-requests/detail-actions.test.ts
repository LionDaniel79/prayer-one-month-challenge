import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPrayerRequestDetail } from "../../components/admin/prayer-requests/AdminPrayerRequestDetail";
import type { AdminPrayerRequestDetail as Detail } from "../../src/features/prayer-requests/types";

const request: Detail = {
  id: "00000000-0000-4000-8000-000000000101",
  requesterName: "검증 성도", createdAt: "2026-09-27T02:00:00Z", status: "received",
  preview: "기도 내용", content: "기도 내용",
};

function render(detail: Detail | null, busy: boolean) {
  return renderToStaticMarkup(React.createElement(AdminPrayerRequestDetail, {
    request: detail, busy, onStatusChange: () => {}, onDelete: () => {},
  }));
}

describe("prayer request detail actions", () => {
  it("offers deletion for the selected request", () => {
    const html = render(request, false);
    const deletion = html.match(/<button\b([^>]*)>기도요청 삭제<\/button>/);
    expect(deletion).not.toBeNull();
    expect(deletion![1]).not.toContain("disabled");
    expect(html).toContain(request.content);
  });

  it("keeps the content visible but disables deletion while an action is pending", () => {
    const html = render(request, true);
    const deletion = html.match(/<button\b([^>]*)>기도요청 삭제<\/button>/);
    expect(deletion).not.toBeNull();
    expect(deletion![1]).toContain("disabled");
    expect(html).toContain(request.content);
  });

  it("does not offer deletion before a request has been selected", () => {
    expect(render(null, false)).not.toContain("<button");
  });
});
