import "server-only";
import type Stripe from "stripe";
import { db } from "../db";
import { getStripe } from "./stripe";
import { LOOKUP_KEYS, customerId, subscriptionRow, type Interval, type PaidTier, type StripeSubLike } from "@/lib/billing";

const priceCache = new Map<string, { id: string; at: number }>();

/** Resolves a price id from its lookup key (cached for 10 minutes). */
export async function priceIdFor(tier: PaidTier, interval: Interval) {
  const key = LOOKUP_KEYS[tier][interval];
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.id;
  const list = await getStripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = list.data[0];
  if (!price) throw new Error(`No active Stripe price with lookup key "${key}". Run \`pnpm stripe:setup\`.`);
  priceCache.set(key, { id: price.id, at: Date.now() });
  return price.id;
}

/** Finds which user a Stripe subscription belongs to (metadata first, then the customer id). */
async function userIdFor(sub: StripeSubLike) {
  if (sub.metadata?.userId) {
    const u = await db.user.findUnique({ where: { id: sub.metadata.userId }, select: { id: true } });
    if (u) return u.id;
  }
  const u = await db.user.findUnique({ where: { stripeCustomerId: customerId(sub) }, select: { id: true } });
  return u?.id ?? null;
}

/** Upserts our Subscription row from a Stripe subscription object. Idempotent. */
export async function syncSubscription(sub: StripeSubLike | Stripe.Subscription) {
  const s = sub as unknown as StripeSubLike;
  const userId = await userIdFor(s);
  if (!userId) {
    console.warn(`[billing] subscription ${s.id} has no matching user`);
    return null;
  }
  const prev = await db.subscription.findUnique({ where: { id: s.id }, select: { pastDueSince: true } });
  const row = subscriptionRow(s, prev);
  if (!row) {
    console.warn(`[billing] subscription ${s.id} uses a price we don't recognize`);
    return null;
  }
  await db.$transaction([
    db.subscription.upsert({ where: { id: row.id }, create: { ...row, userId }, update: row }),
    // Remember the customer, and that this user has used their one free trial.
    db.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId(s), ...(row.trialEnd ? { trialUsedAt: new Date() } : {}) },
    }),
  ]);
  return { userId, row };
}
