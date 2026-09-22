import { describe, expect, it } from "vitest";
import { filterSamOptions } from "../../src/features/sams/service";

describe("sam search", () => {
  const sams = [
    { id: "1", name: "사랑샘", leaderName: "김은혜" },
    { id: "2", name: "믿음샘", leaderName: "박사랑" },
    { id: "3", name: "소망샘", leaderName: "이기쁨" },
  ];

  it("matches both sam name and leader name", () => {
    expect(filterSamOptions(sams, "사랑")).toEqual([sams[0], sams[1]]);
  });

  it("ignores surrounding whitespace and case for latin text", () => {
    const rows = [{ id: "4", name: "Grace 샘", leaderName: "John" }];
    expect(filterSamOptions(rows, "  grace ")).toEqual(rows);
    expect(filterSamOptions(rows, "JOHN")).toEqual(rows);
  });

  it("returns the first 30 rows for an empty query", () => {
    const rows = Array.from({ length: 35 }, (_, i) => ({
      id: String(i),
      name: `샘${i}`,
      leaderName: `리더${i}`,
    }));
    expect(filterSamOptions(rows, "")).toHaveLength(30);
  });
});
