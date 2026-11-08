import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getSession, hasRole } from "./auth";
import { FEATURE_MIN_TIER, PAYMENT_GRACE_DAYS, TIER_RANK, type Feature, type TierId } from "@/config/pricing";
import type { Role } from "@/generated/prisma/enums";

/**
 * The ONE place that answers "can this user do X?".
 * Reads the Subscription table (kept in sync by Stripe webhooks), never Stripe itself.
 */
export interface Entitlement {
  userId: string | null;
  tier: TierId;
  /** Staff (tutors, experts, moderators, admins) get full access regardless of billing. */
  staff: boolean;
  /** For the billing UI: true while a failed payment is inside the grace window. */
  inGracePeriod: boolean;
  currentPeriodStart: Date | null;
}

const ANON: Entitlement = { userId: null, tier: "FREE", staff: false, inGracePeriod: false, currentPeriodStart: null };

export async function entitlementFor(userId: string, role: Role, now = new Date()): Promise<Entitlement> {
  if (hasRole({ role }, "TUTOR")) {
    return { userId, tier: "PREMIUM_TUTORING", staff: true, inGracePeriod: false, currentPeriodStart: null };
  }
  const subs = await db.subscription.findMany({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    select: { tier: true, status: true, pastDueSince: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  let best: Entitlement = { ...ANON, userId };
  for (const s of subs) {
    let inGrace = false;
    if (s.status === "PAST_DUE") {
      const since = s.pastDueSince ?? s.currentPeriodEnd;
      if (now.getTime() > since.getTime() + PAYMENT_GRACE_DAYS * 86_400_000) continue;
      inGrace = true;
    }
    if (TIER_RANK[s.tier] > TIER_RANK[best.tier]) {
      best = { userId, tier: s.tier, staff: false, inGracePeriod: inGrace, currentPeriodStart: s.currentPeriodStart };
    }
  }
  return best;
}

/** Entitlement for the current request (deduped per render). */
export const getEntitlement = cache(async (): Promise<Entitlement> => {
  const session = await getSession();
  if (!session) return ANON;
  return entitlementFor(session.user.id, session.user.role);
});

export function can(ent: Entitlement, feature: Feature) {
  return TIER_RANK[ent.tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export class EntitlementError extends Error {
  constructor(public feature: Feature) {
    super(`Upgrade required for ${feature}`);
  }
}

export async function requireFeature(feature: Feature) {
  const ent = await getEntitlement();
  if (!can(ent, feature)) throw new EntitlementError(feature);
  return ent;
}
