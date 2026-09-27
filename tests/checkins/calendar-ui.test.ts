import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrayerCalendar } from "../../components/calendar/PrayerCalendar";
import type { MemberDashboard } from "../../src/lib/types";

const initial: MemberDashboard = {
  today: "2026-09-27",
  user: { displayName: "검증", position: null, samLabel: null },
  challenge: { id: "challenge", title: "기도운동", startDate: "2026-09-01", endDate: "2026-09-30" },
  completedDates: [],
  progress: { completed: 0, eligible: 23, rate: 0 },
};

function renderCalendar(dashboard = initial, pendingDates = new Set<string>()) {
  return renderToStaticMarkup(React.createElement(PrayerCalendar, {
    dashboard, pendingDates, onToggle: () => {},
  }));
}

function buttons(html: string) {
  return [...html.matchAll(/<button\b([^>]*)>/g)].map((match) => ({
    label: /aria-label="([^"]+)"/.exec(match[1])?.[1],
    disabled: /\bdisabled=""/.test(match[1]),
    busy: /aria-busy="true"/.test(match[1]),
  }));
}

describe("prayer calendar layout and available dates", () => {
  it("aligns September with Sunday first and complete Sunday-to-Saturday weeks", () => {
    const html = renderCalendar();
    const weekdays = html.match(/<div class="weekday-row">(.*?)<\/div>/)?.[1];
    expect([...weekdays!.matchAll(/<span>(.*?)<\/span>/g)].map((match) => match[1]))
      .toEqual(["일", "월", "화", "수", "목", "금", "토"]);
    const cells = buttons(html);
    expect(cells).toHaveLength(35);
    expect(cells[0].label).toBe("8월 30일 도전 기간 밖");
    expect(cells[2].label).toBe("9월 1일 수정 기간 지남");
    expect(cells[34].label).toBe("10월 3일 도전 기간 밖");
  });

  it("does not add an extra week when the challenge already runs Sunday to Saturday", () => {
    const cells = buttons(renderCalendar({ ...initial, challenge: {
      ...initial.challenge, startDate: "2026-09-06", endDate: "2026-09-12",
    } }));
    expect(cells).toHaveLength(7);
    expect(cells[0].label).toBe("9월 6일 일요일");
    expect(cells[6].label).toBe("9월 12일 수정 기간 지남");
  });

  it("keeps Sunday disabled while allowing Saturday's record on Sunday", () => {
    const cells = buttons(renderCalendar());
    expect(cells.find((cell) => cell.label === "9월 27일 일요일")?.disabled).toBe(true);
    expect(cells.find((cell) => cell.label === "9월 26일 기도 완료 체크")?.disabled).toBe(false);
    expect(cells.find((cell) => cell.label === "9월 25일 수정 기간 지남")?.disabled).toBe(true);
  });

  it("disables only the pending record and preserves the other editable date", () => {
    const cells = buttons(renderCalendar({ ...initial, today: "2026-09-26" }, new Set(["2026-09-26"])));
    expect(cells.find((cell) => cell.label === "9월 26일 기도 완료 체크"))
      .toMatchObject({ disabled: true, busy: true });
    expect(cells.find((cell) => cell.label === "9월 25일 기도 완료 체크"))
      .toMatchObject({ disabled: false, busy: false });
  });
});
