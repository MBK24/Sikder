import { describe, expect, it } from "vitest";
import { planForLookupKey, subscriptionRow, type StripeSubLike } from "@/lib/billing";

const base: StripeSubLike = {
  id: "sub_123",
  status: "trialing",
  customer: "cus_1",
  cancel_at_period_end: false,
  cancel_at: null,
  canceled_at: null,
  trial_end: 1_800_000_000,
  metadata: { userId: "u1" },
  items: {
    data: [
      {
        current_period_start: 1_799_000_000,
        current_period_end: 1_801_000_000,
        price: { id: "price_1", lookup_key: "premium_annual", recurring: { interval: "year" } },
      },
    ],
  },
};

describe("billing mapping", () => {
  it("maps lookup keys to tiers", () => {
    expect(planForLookupKey("premium_tutoring_monthly")).toEqual({ tier: "PREMIUM_TUTORING", interval: "MONTH" });
    expect(planForLookupKey("something_else")).toBeNull();
  });

  it("maps a trialing annual subscription", () => {
    const r = subscriptionRow(base)!;
    expect(r).toMatchObject({ tier: "PREMIUM", interval: "YEAR", status: "TRIALING", cancelAtPeriodEnd: false, pastDueSince: null });
    expect(r.trialEnd?.getTime()).toBe(1_800_000_000_000);
    expect(r.currentPeriodEnd.getTime()).toBe(1_801_000_000_000);
  });

  it("treats a scheduled cancel_at as cancel at period end", () => {
    expect(subscriptionRow({ ...base, status: "active", cancel_at: 1_801_000_000 })!.cancelAtPeriodEnd).toBe(true);
  });

  it("starts the grace window on the first past_due event and keeps it stable", () => {
    const first = new Date("2026-05-01T00:00:00Z");
    const r1 = subscriptionRow({ ...base, status: "past_due" }, null, first)!;
    expect(r1.pastDueSince).toEqual(first);
    const r2 = subscriptionRow({ ...base, status: "past_due" }, { pastDueSince: first }, new Date("2026-05-04T00:00:00Z"))!;
    expect(r2.pastDueSince).toEqual(first);
    expect(subscriptionRow({ ...base, status: "active" }, { pastDueSince: first })!.pastDueSince).toBeNull();
  });

  it("ignores subscriptions for prices we don't sell", () => {
    expect(subscriptionRow({ ...base, items: { data: [{ ...base.items.data[0], price: { id: "p", lookup_key: null, recurring: null } }] } })).toBeNull();
  });
});
