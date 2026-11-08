import { describe, expect, it } from "vitest";
import { FEATURE_MIN_TIER, TIER_RANK, TIERS } from "@/config/pricing";

describe("pricing config", () => {
  it("annual plans are discounted roughly 20% vs 12× monthly", () => {
    for (const id of ["PREMIUM", "PREMIUM_TUTORING"] as const) {
      const t = TIERS[id];
      const discount = 1 - t.annualUsd / (t.monthlyUsd * 12);
      expect(discount).toBeGreaterThan(0.15);
      expect(discount).toBeLessThan(0.25);
    }
  });
  it("every feature maps to a known tier", () => {
    for (const tier of Object.values(FEATURE_MIN_TIER)) expect(TIER_RANK[tier]).toBeGreaterThanOrEqual(0);
  });
});
