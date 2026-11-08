import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { getDeck, renderCard } from "@/server/flashcards";
import { CardFlipper } from "@/components/flashcards/CardFlipper";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Flashcard deck", robots: { index: false } };

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

export default function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/flashcards" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← All decks
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Deck params={params} />
      </Suspense>
    </div>
  );
}

async function Deck({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const session = await getSession();
  const deck = await getDeck(deckId, session?.user.id ?? null);
  if (!deck) notFound();
  const ent = await getEntitlement();
  const trusted = deck.kind === "BUILT_IN";
  const cards = deck.cards.map((c) => ({ id: c.id, ...renderCard(c, trusted) }));
  return (
    <>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{deck.title}</h1>
      {deck.chapter ? (
        <p className="mt-1 text-sm text-muted">
          Built from{" "}
          <Link className="underline" href={`/${ENUM_TO_CODE[deck.chapter.part]}/${deck.chapter.slug}`}>
            {deck.chapter.title}
          </Link>
        </p>
      ) : deck.description ? (
        <p className="mt-1 text-muted">{deck.description}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {can(ent, "flashcards.srs") ? (
          <Link href={`/flashcards/review?deck=${deck.id}`} className="btn btn-primary">
            Study with spaced repetition
          </Link>
        ) : null}
        {deck.kind === "USER" ? (
          <Link href={`/flashcards/${deck.id}/edit`} className="btn btn-ghost">
            Edit deck
          </Link>
        ) : null}
      </div>
      <div className="mt-8">
        <CardFlipper cards={cards} />
      </div>
    </>
  );
}
