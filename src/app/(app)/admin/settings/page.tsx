import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { setPromotionCodes } from "@/server/actions/settings";
import { stripeConfigured } from "@/server/billing/stripe";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await connection();
  await requireRole("ADMIN");
  const promo = await db.appSetting.findUnique({ where: { key: "checkout.allowPromotionCodes" } });
  const enabled = promo?.value === true;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <section className="mt-6 max-w-[640px] rounded-lg border border-[var(--c-border)] p-5">
        <h2 className="font-semibold">Promotion codes at checkout</h2>
        <p className="mt-1 text-sm text-muted">
          When on, Stripe Checkout shows an &ldquo;Add promotion code&rdquo; field. Create the codes themselves in the Stripe Dashboard
          (Products → Coupons), where you can limit them by product, date, number of uses, or first-time customers.
        </p>
        <form action={setPromotionCodes} className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={enabled} /> Allow promotion codes
          </label>
          <button className="btn btn-primary !py-1.5 text-sm">Save</button>
          <span className="text-sm text-muted">Currently {enabled ? "on" : "off"}</span>
        </form>
      </section>
      <section className="mt-6 max-w-[640px] rounded-lg border border-[var(--c-border)] p-5 text-sm">
        <h2 className="font-semibold">Payments</h2>
        <p className="mt-1 text-muted">
          Stripe is {stripeConfigured() ? "connected" : "not configured (set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET)"}. Prices, trial
          length, grace period, and tier contents live in <code>src/config/pricing.ts</code>; run <code>pnpm stripe:setup</code> after
          changing a price.
        </p>
      </section>
    </>
  );
}
