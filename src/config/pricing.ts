/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ALL pricing and tier boundaries live here. Prices are PLACEHOLDERS.
 *  Change a number here, then run `pnpm stripe:setup` (phase 5) to sync Stripe.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type TierId = "FREE" | "PREMIUM" | "PREMIUM_TUTORING";

export const TRIAL_DAYS = 7;
/** Days of continued access while Stripe retries a failed payment. */
export const PAYMENT_GRACE_DAYS = 7;
/** Free-tier question bank size (questions flagged `isFree`). */
export const FREE_QBANK_QUESTIONS = 50;
/** Tutoring-session requests included per billing period on Premium + Tutoring. */
export const TUTORING_REQUESTS_PER_PERIOD = 2;

export const TIERS: Record<
  TierId,
  { name: string; monthlyUsd: number; annualUsd: number; blurb: string; highlights: string[] }
> = {
  FREE: {
    name: "Free",
    monthlyUsd: 0,
    annualUsd: 0,
    blurb: "Start reading today.",
    highlights: [
      "Getting Started + the first chapter of every section",
      `${FREE_QBANK_QUESTIONS} question-bank questions`,
      "Basic flashcards",
      "Read the forum",
    ],
  },
  PREMIUM: {
    name: "Premium",
    monthlyUsd: 29,
    annualUsd: 279,
    blurb: "Everything you need to prepare.",
    highlights: [
      "The full book",
      "The full question bank",
      "Timed practice + full-length section tests",
      "Spaced-repetition flashcards and your own decks",
      "Personal analytics",
      "Ask and answer in the forum",
    ],
  },
  PREMIUM_TUTORING: {
    name: "Premium + Tutoring",
    monthlyUsd: 79,
    annualUsd: 749,
    blurb: "Premium, plus priority help from verified tutors.",
    highlights: [
      "Everything in Premium",
      "Priority answers from Verified Tutors",
      `${TUTORING_REQUESTS_PER_PERIOD} tutoring-session requests per month`,
      "Early access to new content",
    ],
  },
};

/** Feature → minimum tier. Entitlement checks read this map (src/server/entitlements.ts). */
export const FEATURE_MIN_TIER = {
  "content.premium": "PREMIUM",
  "content.earlyAccess": "PREMIUM_TUTORING",
  "qbank.full": "PREMIUM",
  "practice.timed": "PREMIUM",
  "practice.sectionTest": "PREMIUM",
  "flashcards.srs": "PREMIUM",
  "flashcards.custom": "PREMIUM",
  analytics: "PREMIUM",
  "forum.post": "PREMIUM",
  "forum.priority": "PREMIUM_TUTORING",
  "tutoring.request": "PREMIUM_TUTORING",
} as const satisfies Record<string, TierId>;

export type Feature = keyof typeof FEATURE_MIN_TIER;

export const TIER_RANK: Record<TierId, number> = { FREE: 0, PREMIUM: 1, PREMIUM_TUTORING: 2 };
