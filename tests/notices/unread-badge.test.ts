import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { UnreadNoticeBadge } from "../../components/notices/UnreadNoticeBadge";

describe("in-app unread notice marker", () => {
  it("uses ! for unread notices while announcing the actual count", () => {
    const html = renderToStaticMarkup(createElement(UnreadNoticeBadge, { count: 3 }));
    expect(html).toContain('aria-label="안 읽은 공지 3개"');
    expect(html).toContain(">!</span>");
    expect(html).not.toContain(">3</span>");
  });
  it("hides the marker after all notices are read", () => {
    expect(renderToStaticMarkup(createElement(UnreadNoticeBadge, { count: 0 }))).toBe("");
  });
});
