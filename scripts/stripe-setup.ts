/**
 * Creates/updates Stripe products + prices from src/config/pricing.ts, configures the
 * Customer Portal, and (optionally) registers the webhook endpoint. Idempotent.
 *
 *   pnpm stripe:setup                                  # products, prices, portal
 *   pnpm stripe:setup --webhook https://your.site      # also create the webhook endpoint
 *
 * Prices in Stripe are immutable: when an amount in pricing.ts changes, a new price is
 * created and the lookup key moves to it (existing subscribers keep their old price
 * until they change plans).
 */
import "dotenv/config";
import Stripe from "stripe";
import { TIERS } from "../src/config/pricing";
import { LOOKUP_KEYS, type PaidTier } from "../src/lib/billing";
import { siteConfig } from "../src/config/site";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (use a test-mode key: sk_test_…) first.");
  process.exit(1);
}
if (key.startsWith("sk_live") && !process.argv.includes("--live")) {
  console.error("Refusing to run against a LIVE key without --live.");
  process.exit(1);
}
const stripe = new Stripe(key);

async function ensureProduct(tier: PaidTier) {
  const found = await stripe.products.search({ query: `metadata['app_tier']:'${tier}'` });
  const name = `${siteConfig.name} ${TIERS[tier].name}`;
  if (found.data[0]) {
    return stripe.products.update(found.data[0].id, { name, description: TIERS[tier].blurb, active: true });
  }
  return stripe.products.create({ name, description: TIERS[tier].blurb, metadata: { app_tier: tier } });
}

async function ensurePrice(product: Stripe.Product, tier: PaidTier, interval: "MONTH" | "YEAR") {
  const lookup = LOOKUP_KEYS[tier][interval];
  const amount = Math.round((interval === "MONTH" ? TIERS[tier].monthlyUsd : TIERS[tier].annualUsd) * 100);
  const existing = (await stripe.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
  if (existing && existing.unit_amount === amount && existing.active && existing.product === product.id) {
    return { price: existing, changed: false };
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval: interval === "MONTH" ? "month" : "year" },
    lookup_key: lookup,
    transfer_lookup_key: true,
    metadata: { app_tier: tier },
  });
  if (existing) await stripe.prices.update(existing.id, { active: false });
  return { price, changed: true };
}

async function main() {
  const prices: Stripe.Price[] = [];
  const products: Stripe.Product[] = [];
  for (const tier of ["PREMIUM", "PREMIUM_TUTORING"] as const) {
    const product = await ensureProduct(tier);
    products.push(product);
    for (const interval of ["MONTH", "YEAR"] as const) {
      const { price, changed } = await ensurePrice(product, tier, interval);
      prices.push(price);
      console.log(
        `${changed ? "created" : "ok     "} ${String(price.lookup_key).padEnd(26)} $${(price.unit_amount! / 100).toFixed(2)} / ${price.recurring?.interval}  ${price.id}`,
      );
    }
  }

  // Customer Portal: switch plans (up/downgrade, monthly<->annual), cancel at period end, update card, invoices.
  const portalConfig: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: { headline: `Manage your ${siteConfig.name} subscription` },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "switched_service", "other"] },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: products.map((p) => ({ product: p.id, prices: prices.filter((x) => x.product === p.id).map((x) => x.id) })),
      },
    },
  };
  const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (configs.data[0]) await stripe.billingPortal.configurations.update(configs.data[0].id, portalConfig as Stripe.BillingPortal.ConfigurationUpdateParams);
  else await stripe.billingPortal.configurations.create(portalConfig);
  console.log("ok      customer portal configured");

  const wIndex = process.argv.indexOf("--webhook");
  if (wIndex > -1) {
    const base = process.argv[wIndex + 1]?.replace(/\/$/, "");
    if (!base) throw new Error("--webhook needs your site URL");
    const endpoint = await stripe.webhookEndpoints.create({
      url: `${base}/api/stripe/webhook`,
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.paused",
        "customer.subscription.resumed",
        "customer.subscription.trial_will_end",
        "invoice.paid",
        "invoice.payment_failed",
      ],
    });
    console.log(`created webhook ${endpoint.url}\n\nSet STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
