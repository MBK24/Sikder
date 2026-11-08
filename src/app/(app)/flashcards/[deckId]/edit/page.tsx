import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getDeck, renderCard } from "@/server/flashcards";
import { deleteCard, deleteDeck } from "@/server/actions/flashcards";
import { AddCardForm } from "@/components/flashcards/DeckForms";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export const metadata: Metadata = { title: "Edit deck", robots: { index: false } };

export default function EditDeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const user = await requireUser(`/flashcards/${deckId}/edit`);
  const deck = await getDeck(deckId, user.id);
  if (!deck || deck.kind !== "USER" || deck.ownerId !== user.id) notFound();
  return (
    <>
      <Link href={`/flashcards/${deck.id}`} className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← {deck.title}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit deck</h1>
      <div className="mt-6">
        <AddCardForm deckId={deck.id} />
      </div>
      <h2 className="mt-10 text-lg font-semibold">
        {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"}
      </h2>
      <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
        {deck.cards.map((c) => {
          const r = renderCard(c, false);
          return (
            <li key={c.id} className="flex gap-4 py-3">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: r.frontHtml }} />
                <div className="prose text-sm text-muted" dangerouslySetInnerHTML={{ __html: r.backHtml }} />
              </div>
              <form action={deleteCard.bind(null, deck.id, c.id)}>
                <button className="btn btn-ghost !px-2 !py-1 text-xs" aria-label="Delete card">
                  Delete
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <form action={deleteDeck.bind(null, deck.id)} className="mt-10">
        <ConfirmButton message={`Delete "${deck.title}" and all its cards? This can't be undone.`} className="btn btn-ghost text-sm !text-[var(--c-trap)]">
          Delete this deck
        </ConfirmButton>
      </form>
    </>
  );
}
