import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { buildReviewQueue, getDeck } from "@/server/flashcards";
import { ReviewSession } from "@/components/flashcards/ReviewSession";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = { title: "Review flashcards", robots: { index: false } };

export default function ReviewPage({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/flashcards" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← All decks
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Building your review…</p>}>
        <Session searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Session({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const user = await requireUser("/flashcards/review");
  const ent = await getEntitlement();
  if (!can(ent, "flashcards.srs")) {
    return (
      <div className="mt-8">
        <Upsell title="Spaced-repetition review is part of Premium">You can still flip through every deck for free.</Upsell>
      </div>
    );
  }
  const { deck: deckId } = await searchParams;
  const deck = deckId ? await getDeck(deckId, user.id) : null;
  const queue = await buildReviewQueue(user.id, deck?.id ?? null);
  return (
    <>
      <h1 className="mb-6 mt-3 text-2xl font-bold tracking-tight">{deck ? deck.title : "Today's review"}</h1>
      <ReviewSession initial={queue} />
    </>
  );
}
