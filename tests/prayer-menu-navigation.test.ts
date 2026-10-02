import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemberSidebar } from "../components/app/MemberSidebar";

vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => React.createElement("a", props, children),
}));
vi.mock("../components/pastoral/ReportStatusBadge", () => ({ ReportBadge: () => null }));
vi.mock("../components/notices/UnreadNoticeBadge", () => ({ UnreadNoticeBadge: () => null }));

function renderMenu(prayerMenuEnabled: boolean, pastoralVisible = false) {
  const props = { unreadCount: 0, prayerMenuEnabled, pastoralVisible };
  return renderToStaticMarkup(React.createElement(MemberSidebar, props));
}

describe("member prayer menu visibility", () => {
  it("puts notices first and prayer immediately after notices", () => {
    const html = renderMenu(true);
    const labels = ["공지", "기도운동", "심방신청", "기도요청", "커뮤니티"];
    const positions = labels.map((label) => html.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it.each([false, true])("hides prayer for every pastoral permission (%s) without hiding other menus", (pastoralVisible) => {
    const html = renderMenu(false, pastoralVisible);
    expect(html).not.toContain(">기도운동<");
    expect(html).toContain(">공지<");
    expect(html).toContain(">심방신청<");
    expect(html).toContain(">기도요청<");
    expect(html).toContain(">커뮤니티<");
    expect(html.includes(">목양지<")).toBe(pastoralVisible);
  });

  it("keeps prayer visible by default for existing callers", () => {
    const html = renderToStaticMarkup(React.createElement(MemberSidebar, { unreadCount: 0 }));
    expect(html).toContain(">기도운동<");
  });
});
