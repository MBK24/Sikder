"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { getEntitlement } from "@/server/entitlements";
import { getStripe, stripeConfigured } from "@/server/billing/stripe";
import { priceIdFor } from "@/server/billing/sync";
import { TRIAL_DAYS } from "@/config/pricing";
import { siteConfig } from "@/config/site";

const schema = z.object({ tier: z.enum(["PREMIUM", "PREMIUM_TUTORING"]), interval: z.enum(["MONTH", "YEAR"]) });

async function ensureCustomer(user: { id: string; email: string; name?: string | null }) {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (row.stripeCustomerId) return row.stripeCustomerId;
  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userId: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Starts Stripe Checkout for a plan. Existing subscribers are sent to the portal to switch plans instead. */
export async function startCheckout(form: FormData) {
  const { tier, interval } = schema.parse(Object.fromEntries(form));
  const s = await getSession();
  if (!s) redirect(`/sign-up?next=${encodeURIComponent(`/pricing?plan=${tier}&interval=${interval}`)}`);
  if (!stripeConfigured()) redirect("/pricing?error=not-configured");

  const ent = await getEntitlement();
  if (ent.tier !== "FREE" && !ent.staff) await openBillingPortal();

  const [customer, price, user, promo] = await Promise.all([
    ensureCustomer(s.user),
    priceIdFor(tier, interval),
    db.user.findUniqueOrThrow({ where: { id: s.user.id }, select: { trialUsedAt: true } }),
    db.appSetting.findUnique({ where: { key: "checkout.allowPromotionCodes" } }),
  ]);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: s.user.id,
    line_items: [{ price, quantity: 1 }],
    // Card required up front; one trial per account.
    payment_method_collection: "always",
    subscription_data: {
      metadata: { userId: s.user.id },
      ...(user.trialUsedAt ? {} : { trial_period_days: TRIAL_DAYS }),
    },
    allow_promotion_codes: promo?.value === true,
    success_url: `${siteConfig.url}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteConfig.url}/pricing?canceled=1`,
  });
  redirect(session.url!);
}

/** Opens the Stripe Customer Portal (upgrade, downgrade, cancel, payment method, invoices). */
export async function openBillingPortal() {
  const s = await getSession();
  if (!s) redirect("/sign-in?next=/account/billing");
  if (!stripeConfigured()) redirect("/account/billing?error=not-configured");
  const customer = await ensureCustomer(s.user);
  const portal = await getStripe().billingPortal.sessions.create({ customer, return_url: `${siteConfig.url}/account/billing` });
  redirect(portal.url);
}
