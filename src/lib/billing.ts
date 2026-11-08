/**
 * Pure helpers that translate Stripe objects into our Subscription rows.
 * No Stripe SDK import here, so it can be unit-tested with plain fixtures.
 */
import type { TierId } from "@/config/pricing";

export type PaidTier = Exclude<TierId, "FREE">;
export type Interval = "MONTH" | "YEAR";

/** Stripe price lookup keys. `pnpm stripe:setup` creates prices under these keys. */
export const LOOKUP_KEYS: Record<PaidTier, Record<Interval, string>> = {
  PREMIUM: { MONTH: "premium_monthly", YEAR: "premium_annual" },
  PREMIUM_TUTORING: { MONTH: "premium_tutoring_monthly", YEAR: "premium_tutoring_annual" },
};

export function planForLookupKey(key: string | null | undefined): { tier: PaidTier; interval: Interval } | null {
  for (const tier of Object.keys(LOOKUP_KEYS) as PaidTier[]) {
    for (const interval of ["MONTH", "YEAR"] as const) {
      if (LOOKUP_KEYS[tier][interval] === key) return { tier, interval };
    }
  }
  return null;
}

export type OurStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "UNPAID" | "CANCELED" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "PAUSED";

export function mapStatus(s: string): OurStatus {
  const m: Record<string, OurStatus> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    paused: "PAUSED",
  };
  return m[s] ?? "INCOMPLETE";
}

/** The subset of a Stripe Subscription we read. */
export interface StripeSubLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  canceled_at: number | null;
  trial_end: number | null;
  metadata: Record<string, string>;
  items: {
    data: {
      current_period_start: number;
      current_period_end: number;
      price: { id: string; lookup_key: string | null; recurring: { interval: string } | null };
    }[];
  };
}

export interface SubscriptionRow {
  id: string;
  tier: PaidTier;
  interval: Interval;
  status: OurStatus;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  canceledAt: Date | null;
  pastDueSince: Date | null;
}

const ts = (s: number | null) => (s ? new Date(s * 1000) : null);

/**
 * Maps a Stripe subscription to our row. `previous` keeps `pastDueSince` stable across
 * repeated past_due events, so the grace window starts when payment first failed.
 */
export function subscriptionRow(sub: StripeSubLike, previous?: { pastDueSince: Date | null } | null, now = new Date()): SubscriptionRow | null {
  const item = sub.items.data[0];
  if (!item) return null;
  const plan = planForLookupKey(item.price.lookup_key);
  if (!plan) return null;
  const status = mapStatus(sub.status);
  return {
    id: sub.id,
    tier: plan.tier,
    interval: item.price.recurring?.interval === "year" ? "YEAR" : plan.interval,
    status,
    stripePriceId: item.price.id,
    currentPeriodStart: new Date(item.current_period_start * 1000),
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    // The portal may schedule cancellation with cancel_at instead of cancel_at_period_end.
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
    trialEnd: ts(sub.trial_end),
    canceledAt: ts(sub.canceled_at),
    pastDueSince: status === "PAST_DUE" ? (previous?.pastDueSince ?? now) : null,
  };
}

export function customerId(sub: { customer: string | { id: string } }) {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}
