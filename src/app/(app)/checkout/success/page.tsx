import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { getStripe, stripeConfigured } from "@/server/billing/stripe";
import { syncSubscription } from "@/server/billing/sync";
import { TIERS } from "@/config/pricing";

export const metadata: Metadata = { title: "Welcome to Premium", robots: { index: false } };

export default function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  return (
    <div className="mx-auto max-w-[620px] px-4 pb-24 pt-16 text-center font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Confirming your subscription…</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * Syncs the subscription right away instead of waiting for the webhook, so access is
 * there the moment the student lands back on the site. The webhook remains the source of truth.
 */
async function Confirm({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const user = await requireUser("/account/billing");
  const { session_id } = await searchParams;
  let tierName: string | null = null;
  let trialEnd: Date | null = null;
  if (session_id && stripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id, { expand: ["subscription"] });
      if (session.client_reference_id === user.id && session.subscription && typeof session.subscription !== "string") {
        const synced = await syncSubscription(session.subscription);
        if (synced) {
          tierName = TIERS[synced.row.tier].name;
          trialEnd = synced.row.trialEnd;
        }
      }
    } catch (err) {
      console.error("[checkout] could not confirm session", err);
    }
  }
  return (
    <>
      <p className="text-5xl" aria-hidden>
        🎉
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold">{tierName ? `Welcome to ${tierName}` : "Thanks for subscribing"}</h1>
      <p className="mt-3 font-serif text-lg text-muted">
        {trialEnd
          ? `Your free trial runs until ${trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. We'll email you before it ends.`
          : "Your subscription is active. If anything still looks locked, give it a few seconds and refresh."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Keep reading
        </Link>
        <Link href="/practice/test" className="btn btn-ghost">
          Try a section test
        </Link>
      </div>
    </>
  );
}
