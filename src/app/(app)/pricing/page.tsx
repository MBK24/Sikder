import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/server/auth";
import { getEntitlement } from "@/server/entitlements";
import { PricingCards, type PlanView } from "@/components/billing/PricingCards";
import { FREE_QBANK_QUESTIONS, PAYMENT_GRACE_DAYS, TIERS, TRIAL_DAYS, TUTORING_REQUESTS_PER_PERIOD } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Start free. Premium unlocks the full MCAT book, question bank, section tests, flashcards, and analytics, with a ${TRIAL_DAYS}-day free trial.`,
  alternates: { canonical: "/pricing" },
};

const plans: PlanView[] = (["FREE", "PREMIUM", "PREMIUM_TUTORING"] as const).map((id) => ({ id, ...TIERS[id] }));

const ROWS: [string, string | boolean, string | boolean, string | boolean][] = [
  ["Getting Started + first chapter of every section", true, true, true],
  ["The full book (every chapter, appendix)", false, true, true],
  ["Inline practice questions and chapter quizzes", "Free chapters", true, true],
  ["Question bank", `${FREE_QBANK_QUESTIONS} questions`, "Full bank", "Full bank"],
  ["Timed sets and full-length section tests", false, true, true],
  ["Flashcards", "Browse decks", "Spaced repetition + your own decks", "Spaced repetition + your own decks"],
  ["Personal analytics and readiness", "Sample", true, true],
  ["Forum", "Read", "Ask, answer, vote", "Ask, answer, vote"],
  ["Priority answers from Verified Tutors", false, false, true],
  ["1:1 tutoring-session requests", false, false, `${TUTORING_REQUESTS_PER_PERIOD} per month`],
  ["Early access to new chapters", false, false, true],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return (
      <span className="text-[var(--c-ok)]">
        ✓<span className="sr-only">Included</span>
      </span>
    );
  if (v === false)
    return (
      <span className="text-muted">
        –<span className="sr-only">Not included</span>
      </span>
    );
  return <span>{v}</span>;
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function PricingPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="mx-auto max-w-[1060px] px-4 pb-24 pt-12 font-sans sm:px-6">
      <header className="mx-auto max-w-[680px] text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Plans and pricing</h1>
        <p className="mt-3 font-serif text-lg text-muted">
          Read the first chapter of every section free, forever. When you&apos;re ready for the whole book and full practice, try Premium
          free for {TRIAL_DAYS} days.
        </p>
      </header>
      <Suspense fallback={null}>
        <Notices searchParams={searchParams} />
      </Suspense>
      <div className="mt-10">
        <PricingCards plans={plans} trialDays={TRIAL_DAYS} />
      </div>

      <section className="mt-16" aria-labelledby="compare">
        <h2 id="compare" className="text-2xl font-bold">
          Compare plans
        </h2>
        <div className="table-wrap">
          <table className="viz-table min-w-[640px]">
            <thead>
              <tr>
                <th className="w-2/5">Feature</th>
                {plans.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, ...cells]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {cells.map((c, i) => (
                    <td key={i}>
                      <Cell v={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-[760px]" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold">
          Questions
        </h2>
        <div className="book-prose prose mt-4">
          <h3>How does the free trial work?</h3>
          <p>
            Premium plans start with {TRIAL_DAYS} days free. We ask for a card up front, remind you before the trial ends, and you can
            cancel anytime before then without being charged. Each account gets one trial.
          </p>
          <h3>Can I switch between monthly and annual, or change plans?</h3>
          <p>
            Yes. From <Link href="/account/billing">Billing</Link> you can upgrade, downgrade, switch billing period, update your card,
            or cancel. Changes are prorated automatically.
          </p>
          <h3>What happens if I cancel?</h3>
          <p>You keep Premium until the end of the period you&apos;ve paid for, then move to the Free plan. Your progress and history stay.</p>
          <h3>What if a payment fails?</h3>
          <p>You keep full access for {PAYMENT_GRACE_DAYS} days while we retry the card and email you a link to update it.</p>
          <h3>Is the content written for the current MCAT?</h3>
          <p>
            Yes. Chapters follow the AAMC&apos;s content outline for all four sections, and practice questions are written in the
            exam&apos;s passage-based style.
          </p>
        </div>
      </section>
    </div>
  );
}

async function Notices({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await getSession();
  const ent = session ? await getEntitlement() : null;
  return (
    <div className="mx-auto mt-6 max-w-[680px] space-y-2 text-center text-sm">
      {sp.error === "not-configured" ? (
        <p role="alert" className="rounded-md border border-[var(--c-hy)] bg-[var(--c-hy-bg)] px-4 py-2">
          Payments aren&apos;t set up on this site yet (no Stripe keys). See the README for Stripe test-mode setup.
        </p>
      ) : null}
      {sp.canceled ? <p className="text-muted">Checkout canceled. You haven&apos;t been charged.</p> : null}
      {ent ? (
        <p className="mx-auto max-w-max rounded-full border border-[var(--c-border)] px-4 py-1.5">
          You&apos;re on <strong>{TIERS[ent.tier].name}</strong>
          {ent.staff ? " (staff access)" : ""}.{" "}
          {ent.tier !== "FREE" && !ent.staff ? (
            <Link href="/account/billing" className="text-[var(--c-accent)] underline">
              Manage billing
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
