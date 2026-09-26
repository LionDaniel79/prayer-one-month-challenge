import { describe, expect, it } from "vitest";
import { toggleCheckin, type CheckinRepository } from "../../src/features/checkins/service";

function setup(initial = false) {
  const dates = new Set(initial ? ["2026-09-17"] : []);
  const repository: CheckinRepository = {
    getActiveChallenge: async () => ({ id: "challenge-1", title: "기도운동", startDate: "2026-09-01", endDate: "2026-09-30" }),
    findCheckin: async (_user, _challenge, date) => dates.has(date) ? { id: date } : null,
    insertCheckin: async (_user, _challenge, date) => { dates.add(date); },
    deleteCheckin: async (id) => { dates.delete(id); },
    getCompletedDates: async () => [...dates],
    getMemberIdentity: async () => ({ displayName: "테스트", position: null, samLabel: null }),
  };
  return { repository, dates };
}

const base = { userId: "member-1", prayerDate: "2026-09-17", now: new Date("2026-09-17T03:00:00Z") };

describe("retry-safe prayer check-ins", () => {
  it("does not undo a saved check when the successful response was lost", async () => {
    const { repository, dates } = setup();
    const request = { ...base, checked: true };
    await toggleCheckin(request, repository);
    await expect(toggleCheckin(request, repository)).resolves.toBe("checked");
    expect([...dates]).toEqual([base.prayerDate]);
  });

  it("does not recreate a cancelled check when an uncheck is retried", async () => {
    const { repository, dates } = setup(true);
    const request = { ...base, checked: false };
    await toggleCheckin(request, repository);
    await expect(toggleCheckin(request, repository)).resolves.toBe("unchecked");
    expect(dates.size).toBe(0);
  });

  it("keeps an already checked date checked on another device", async () => {
    const { repository, dates } = setup(true);
    await expect(toggleCheckin({ ...base, ...{ checked: true } }, repository)).resolves.toBe("checked");
    expect(dates.size).toBe(1);
  });

  it("keeps an already unchecked date unchecked on another device", async () => {
    const { repository, dates } = setup();
    await expect(toggleCheckin({ ...base, ...{ checked: false } }, repository)).resolves.toBe("unchecked");
    expect(dates.size).toBe(0);
  });

  it.each([true, false])("still rejects expired edit windows for checked=%s", async (checked) => {
    const { repository } = setup();
    const request = { ...base, prayerDate: "2026-09-15", checked };
    await expect(toggleCheckin(request, repository)).rejects.toThrow("DATE_NOT_MUTABLE");
  });

  it("does not write into a newly activated challenge from a stale screen", async () => {
    const { repository, dates } = setup();
    const request = { ...base, checked: true, challengeId: "previous-challenge" };
    await expect(toggleCheckin(request, repository)).rejects.toThrow("CHALLENGE_CHANGED");
    expect(dates.size).toBe(0);
  });

  it("retains legacy toggle behavior when no desired state is supplied", async () => {
    const { repository } = setup();
    await expect(toggleCheckin(base, repository)).resolves.toBe("checked");
    await expect(toggleCheckin(base, repository)).resolves.toBe("unchecked");
  });
});
