import { describe, expect, it } from "vitest";
import {
  type CheckinRepository,
  toggleCheckin,
} from "../../src/features/checkins/service";

function fakeRepo(initial: string[] = [], insertError?: Error & { code?: string }) {
  const dates = new Set(initial);
  const repo: CheckinRepository = {
    getActiveChallenge: async () => ({
      id: "challenge-1",
      title: "기도운동 1달 도전",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    }),
    findCheckin: async (_userId, _challengeId, date) =>
      dates.has(date) ? { id: date } : null,
    deleteCheckin: async (id) => { dates.delete(id); },
    insertCheckin: async (_userId, _challengeId, date) => {
      if (insertError) throw insertError;
      dates.add(date);
    },
    getCompletedDates: async () => [...dates],
    getMemberIdentity: async () => ({
      displayName: "홍길동",
      position: "집사",
      samLabel: "1-6",
    }),
  };
  return { repo, dates };
}

describe("prayer check-in toggle", () => {
  const now = new Date("2026-09-17T03:00:00Z");

  it("checks today and unchecks it when toggled again", async () => {
    const { repo, dates } = fakeRepo();
    await expect(toggleCheckin({ userId: "u1", prayerDate: "2026-09-17", now }, repo)).resolves.toBe("checked");
    expect(dates.has("2026-09-17")).toBe(true);
    await expect(toggleCheckin({ userId: "u1", prayerDate: "2026-09-17", now }, repo)).resolves.toBe("unchecked");
    expect(dates.has("2026-09-17")).toBe(false);
  });

  it("allows yesterday", async () => {
    const { repo } = fakeRepo();
    await expect(toggleCheckin({ userId: "u1", prayerDate: "2026-09-16", now }, repo)).resolves.toBe("checked");
  });

  it.each(["2026-09-15", "2026-09-18", "2026-09-13"])("rejects non-mutable date %s", async (prayerDate) => {
    const { repo } = fakeRepo();
    await expect(toggleCheckin({ userId: "u1", prayerDate, now }, repo)).rejects.toThrow("DATE_NOT_MUTABLE");
  });

  it("rejects dates outside the active challenge", async () => {
    const { repo } = fakeRepo();
    await expect(toggleCheckin({ userId: "u1", prayerDate: "2026-08-31", now: new Date("2026-09-01T03:00:00Z") }, repo)).rejects.toThrow("DATE_NOT_MUTABLE");
  });

  it("treats a concurrent duplicate insert as already checked", async () => {
    const error = Object.assign(new Error("duplicate"), { code: "23505" });
    const { repo } = fakeRepo([], error);
    await expect(toggleCheckin({ userId: "u1", prayerDate: "2026-09-17", now }, repo)).resolves.toBe("checked");
  });
});
