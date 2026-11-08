import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { listDecks, type DeckSummary } from "@/server/flashcards";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "MCAT flashcard decks for every chapter, scheduled with spaced repetition.",
};

const PART_TITLE: Record<string, string> = { CP: "Chem/Phys", CARS: "CARS", BB: "Bio/Biochem", PS: "Psych/Soc", APPENDIX: "Appendix", GETTING_STARTED: "Getting Started" };

export default function FlashcardsPage() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
      <p className="mt-2 max-w-prose font-serif text-lg text-muted">
        One deck per chapter, written to match the book. Spaced repetition shows each card again just before you&apos;d forget it,
        so a few minutes a day goes a long way.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading decks…</p>}>
        <Decks />
      </Suspense>
    </div>
  );
}

function DeckRow({ d, srs }: { d: DeckSummary; srs: boolean }) {
  return (
    <li>
      <Link href={`/flashcards/${d.id}`} className="group flex items-center gap-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold group-hover:text-[var(--c-accent)]">{d.title}</span>
          <span className="text-sm text-muted">{d.total} cards</span>
        </span>
        {srs ? (
          <span className="flex gap-2 text-sm tabular-nums">
            {d.due ? <span className="badge !border-[var(--c-accent)] !text-[var(--c-accent)]">{d.due} due</span> : null}
            {d.fresh ? <span className="text-muted">{d.fresh} new</span> : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

async function Decks() {
  const session = await getSession();
  const ent = await getEntitlement();
  const srs = can(ent, "flashcards.srs");
  const decks = await listDecks(session?.user.id ?? null);
  const builtIn = decks.filter((d) => d.kind === "BUILT_IN");
  const mine = decks.filter((d) => d.kind === "USER");
  const totalDue = decks.reduce((n, d) => n + d.due, 0);
  const groups = [...new Set(builtIn.map((d) => d.part ?? "OTHER"))];

  return (
    <>
      {srs ? (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--c-accent)] bg-[var(--c-accent-soft)] p-5">
          <div className="flex-1">
            <p className="font-semibold">{totalDue ? `${totalDue} card${totalDue === 1 ? "" : "s"} due` : "You're all caught up"}</p>
            <p className="text-sm text-muted">Reviews from every deck, plus up to 20 new cards.</p>
          </div>
          <Link href="/flashcards/review" className="btn btn-primary">
            Study now
          </Link>
        </div>
      ) : session ? (
        <div className="mt-8">
          <Upsell title="Flip through every deck for free" compact>
            Premium adds spaced-repetition scheduling, due-card reviews, and your own decks.
          </Upsell>
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-[var(--c-border)] p-4 text-sm">
          <Link href="/sign-up?next=/flashcards" className="font-semibold text-[var(--c-accent)] underline">
            Create a free account
          </Link>{" "}
          to keep track of your decks.
        </p>
      )}

      {groups.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{PART_TITLE[g] ?? "Other"}</h2>
          <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
            {builtIn.filter((d) => (d.part ?? "OTHER") === g).map((d) => (
              <DeckRow key={d.id} d={d} srs={srs} />
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">My decks</h2>
          {can(ent, "flashcards.custom") ? (
            <Link href="/flashcards/new" className="btn btn-ghost !py-1.5 text-sm">
              + New deck
            </Link>
          ) : null}
        </div>
        {mine.length ? (
          <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
            {mine.map((d) => (
              <DeckRow key={d.id} d={d} srs={srs} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {can(ent, "flashcards.custom") ? "You haven't made any decks yet." : "Creating your own decks is part of Premium."}
          </p>
        )}
      </section>
    </>
  );
}
