import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getEntitlement } from "@/server/entitlements";
import { openBillingPortal } from "@/server/actions/billing";
import { stripeConfigured } from "@/server/billing/stripe";
import { PAYMENT_GRACE_DAYS, TIERS } from "@/config/pricing";

export const metadata: Metadata = { title: "Billing", robots: { index: false } };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function BillingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <Link href="/account" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Account
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Billing</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Billing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("/account/billing");
  const { error } = await searchParams;
  const ent = await getEntitlement();
  const sub = await db.subscription.findFirst({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }],
  });
  const active = sub && ["TRIALING", "ACTIVE", "PAST_DUE"].includes(sub.status);
  const graceEnds = sub?.pastDueSince ? new Date(sub.pastDueSince.getTime() + PAYMENT_GRACE_DAYS * 86_400_000) : null;

  return (
    <div className="mt-6 space-y-6">
      {error === "not-configured" ? (
        <p role="alert" className="rounded-md border border-[var(--c-hy)] bg-[var(--c-hy-bg)] px-4 py-2 text-sm">
          Payments aren&apos;t set up on this site yet.
        </p>
      ) : null}

      <section className="rounded-lg border border-[var(--c-border)] p-5">
        <p className="text-sm text-muted">Current plan</p>
        <p className="mt-1 text-2xl font-bold">
          {TIERS[ent.tier].name}
          {ent.staff ? <span className="ml-2 text-sm font-normal text-muted">(staff access)</span> : null}
        </p>
        {sub && active ? (
          <ul className="mt-3 space-y-1 text-sm">
            <li>Billed {sub.interval === "YEAR" ? "annually" : "monthly"}</li>
            {sub.status === "TRIALING" && sub.trialEnd ? (
              <li>
                Free trial until <strong>{fmt(sub.trialEnd)}</strong>
                {sub.cancelAtPeriodEnd ? ". It won't renew." : ", then your card is charged."}
              </li>
            ) : sub.cancelAtPeriodEnd ? (
              <li>
                Cancels on <strong>{fmt(sub.currentPeriodEnd)}</strong>. You keep access until then.
              </li>
            ) : (
              <li>
                Renews on <strong>{fmt(sub.currentPeriodEnd)}</strong>
              </li>
            )}
          </ul>
        ) : null}
        {sub?.status === "PAST_DUE" ? (
          <p role="alert" className="mt-4 rounded-md border border-[var(--c-trap)] bg-[var(--c-trap-bg)] px-3 py-2 text-sm text-[var(--c-trap)]">
            Your last payment failed.{" "}
            {graceEnds && ent.inGracePeriod
              ? `You'll keep access until ${fmt(graceEnds)} while we retry. Update your card to avoid losing access.`
              : "Update your card to restore access."}
          </p>
        ) : null}
        {sub && !active && sub.status !== "INCOMPLETE" ? (
          <p className="mt-3 text-sm text-muted">Your {TIERS[sub.tier].name} subscription ended. Your progress is saved if you come back.</p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        {sub || ent.tier !== "FREE" ? (
          stripeConfigured() && !ent.staff ? (
            <form action={openBillingPortal}>
              <button className="btn btn-primary">Manage subscription</button>
            </form>
          ) : null
        ) : null}
        {!active && !ent.staff ? (
          <Link href="/pricing" className="btn btn-primary">
            See plans
          </Link>
        ) : null}
      </div>
      {sub && active ? (
        <p className="text-sm text-muted">
          The secure Stripe portal lets you switch plans or billing period, update your card, download invoices, or cancel.
        </p>
      ) : null}
    </div>
  );
}
