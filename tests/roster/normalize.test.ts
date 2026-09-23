import { describe, expect, it } from "vitest";
import {
  canonicalizeRosterName,
  formatPhoneForDisplay,
  makeSamLabel,
  normalizeOptionalPhone,
  normalizeRosterPhone,
} from "../../src/features/roster/normalize";

describe("roster normalization", () => {
  it.each([
    ["김은희A", "김은희"],
    ["김은희 B", "김은희"],
    ["  김은희b  ", "김은희"],
    ["김은희", "김은희"],
  ])("canonicalizes %s to %s", (input, expected) => {
    expect(canonicalizeRosterName(input)).toBe(expected);
  });

  it("does not strip a fully non-Korean name", () => {
    expect(canonicalizeRosterName("Alice")).toBe("Alice");
  });

  it("normalizes phone punctuation, accepts blank roster phones, and formats admin display", () => {
    expect(normalizeRosterPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeOptionalPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeOptionalPhone("")).toBeNull();
    expect(formatPhoneForDisplay("01012345678")).toBe("010-1234-5678");
  });

  it("formats village and sam as village-sam", () => {
    expect(makeSamLabel("1마을", "6샘")).toBe("1-6");
    expect(makeSamLabel("01마을", "06샘")).toBe("1-6");
    expect(makeSamLabel(" 12 마을 ", " 3 샘 ")).toBe("12-3");
    expect(makeSamLabel("1마을", null)).toBeNull();
  });
});
