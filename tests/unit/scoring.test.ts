import { describe, expect, it } from "vitest";
import { arrangeLikeExam, computeStreak, estimateScaled, readinessScore, type Candidate } from "@/lib/scoring";

function bank(passages: number, perPassage: number, discretes: number): Candidate[] {
  const out: Candidate[] = [];
  for (let p = 0; p < passages; p++)
    for (let q = 0; q < perPassage; q++) out.push({ id: `p${p}q${q}`, passageId: `p${p}`, passageOrder: q + 1 });
  for (let d = 0; d < discretes; d++) out.push({ id: `d${d}`, passageId: null, passageOrder: null });
  return out;
}

describe("arrangeLikeExam", () => {
  it("returns exactly the requested count with no duplicates", () => {
    const ids = arrangeLikeExam(bank(12, 5, 20), 59);
    expect(ids).toHaveLength(59);
    expect(new Set(ids).size).toBe(59);
  });

  it("keeps each passage's questions together and in order", () => {
    const ids = arrangeLikeExam(bank(12, 5, 20), 59);
    const positions = new Map<string, number[]>();
    ids.forEach((id, i) => {
      const m = /^p(\d+)q(\d+)$/.exec(id);
      if (m) positions.set(m[1], [...(positions.get(m[1]) ?? []), i]);
    });
    for (const [p, pos] of positions) {
      // contiguous
      expect(pos[pos.length - 1] - pos[0]).toBe(pos.length - 1);
      // in passage order
      const qs = pos.map((i) => Number(ids[i].split("q")[1]));
      expect(qs).toEqual([...qs].sort((a, b) => a - b));
      expect(p).toBeTruthy();
    }
  });

  it("uses roughly three quarters passage questions when discretes exist", () => {
    const ids = arrangeLikeExam(bank(12, 5, 20), 59);
    const passageQs = ids.filter((id) => id.startsWith("p")).length;
    expect(passageQs).toBeGreaterThanOrEqual(40);
    expect(passageQs).toBeLessThanOrEqual(48);
  });

  it("returns everything available when the bank is smaller than requested", () => {
    expect(arrangeLikeExam(bank(2, 4, 3), 59)).toHaveLength(11);
  });

  it("works with discretes only (CARS-like inverse) and passages only", () => {
    expect(arrangeLikeExam(bank(0, 0, 10), 5)).toHaveLength(5);
    expect(arrangeLikeExam(bank(9, 6, 0), 53)).toHaveLength(53);
  });
});

describe("estimateScaled", () => {
  it("maps chance to the floor and near-perfect to the ceiling", () => {
    expect(estimateScaled(15, 59)).toBe(118);
    expect(estimateScaled(59, 59)).toBe(132);
  });
  it("is monotonic", () => {
    let prev = 0;
    for (let c = 0; c <= 59; c++) {
      const v = estimateScaled(c, 59)!;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("computeStreak", () => {
  it("counts back from today", () => {
    expect(computeStreak(["2026-03-01", "2026-03-02", "2026-03-03"], "2026-03-03")).toEqual({ current: 3, longest: 3 });
  });
  it("keeps the streak alive until the day is over", () => {
    expect(computeStreak(["2026-03-01", "2026-03-02"], "2026-03-03").current).toBe(2);
  });
  it("breaks after a missed day and remembers the longest run", () => {
    const r = computeStreak(["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-03-02", "2026-03-03"], "2026-03-03");
    expect(r).toEqual({ current: 2, longest: 4 });
  });
  it("is zero with no recent activity", () => {
    expect(computeStreak(["2026-01-01"], "2026-03-03").current).toBe(0);
  });
});

describe("readinessScore", () => {
  it("weights accuracy, coverage, and reading", () => {
    expect(readinessScore(1, 1, 1)).toBe(100);
    expect(readinessScore(null, 0, 0)).toBe(0);
    expect(readinessScore(0.5, 0, 0)).toBe(30);
  });
});
