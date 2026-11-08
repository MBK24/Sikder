"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { startCheckout } from "@/server/actions/billing";

export interface PlanView {
  id: "FREE" | "PREMIUM" | "PREMIUM_TUTORING";
  name: string;
  blurb: string;
  monthlyUsd: number;
  annualUsd: number;
  highlights: string[];
}

const usd = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export function PricingCards({ plans, trialDays }: { plans: PlanView[]; trialDays: number }) {
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("YEAR");
  const maxSaving = Math.max(...plans.filter((p) => p.monthlyUsd).map((p) => 1 - p.annualUsd / (p.monthlyUsd * 12)));
  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-[var(--c-border)] p-1 text-sm">
          {(["MONTH", "YEAR"] as const).map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={interval === i}
              onClick={() => setInterval(i)}
              className={clsx("rounded-full px-4 py-1.5 font-semibold", interval === i ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-muted")}
            >
              {i === "MONTH" ? "Monthly" : `Annual · save ${Math.round(maxSaving * 100)}%`}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-8 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const featured = p.id === "PREMIUM";
          const perMonth = interval === "YEAR" ? p.annualUsd / 12 : p.monthlyUsd;
          return (
            <li key={p.id} className={clsx("flex flex-col rounded-xl border p-6", featured ? "border-2 border-[var(--c-accent)]" : "border-[var(--c-border)]")}>
              {featured ? <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--c-accent)]">Most popular</p> : null}
              <h2 className="text-xl font-bold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              <p className="mt-5">
                <span className="text-4xl font-bold">{p.monthlyUsd ? usd(Math.round(perMonth * 100) / 100) : "$0"}</span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <p className="h-5 text-xs text-muted">
                {p.monthlyUsd ? (interval === "YEAR" ? `${usd(p.annualUsd)} billed yearly` : "billed monthly") : "free forever"}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <svg viewBox="0 0 24 24" width="16" height="16" className="mt-0.5 shrink-0 text-[var(--c-ok)]" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>
              {p.id === "FREE" ? (
                <Link href="/sign-up" className="btn btn-ghost mt-6 w-full">
                  Start free
                </Link>
              ) : (
                <form action={startCheckout} className="mt-6">
                  <input type="hidden" name="tier" value={p.id} />
                  <input type="hidden" name="interval" value={interval} />
                  <button className={clsx("btn w-full", featured ? "btn-primary" : "btn-ghost")}>Start {trialDays}-day free trial</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
