"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gradeCard, previewIntervals } from "@/server/actions/flashcards";
import type { Grade } from "@/lib/srs/sm2";

export interface ReviewItem {
  id: string;
  deckTitle: string;
  isNew: boolean;
  frontHtml: string;
  backHtml: string;
}

const BUTTONS: { grade: Grade; label: string; key: string; cls: string }[] = [
  { grade: "again", label: "Again", key: "1", cls: "grade-again" },
  { grade: "hard", label: "Hard", key: "2", cls: "grade-hard" },
  { grade: "good", label: "Good", key: "3", cls: "grade-good" },
  { grade: "easy", label: "Easy", key: "4", cls: "grade-easy" },
];

/** Spaced-repetition review: reveal, then grade. "Again" cards return later in the same session. */
export function ReviewSession({ initial }: { initial: ReviewItem[] }) {
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [preview, setPreview] = useState<{ cardId: string; v: Record<Grade, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(0);
  const card = queue[0];

  useEffect(() => {
    shownAt.current = performance.now();
    if (!card) return;
    let live = true;
    previewIntervals(card.id)
      .then((v) => live && v && setPreview({ cardId: card.id, v }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [card]);
  const intervals = preview && card && preview.cardId === card.id ? preview.v : null;

  const grade = useCallback(
    async (g: Grade) => {
      if (!card || busy) return;
      setBusy(true);
      setError(null);
      const r = await gradeCard({ cardId: card.id, grade: g, durationMs: Math.round(performance.now() - shownAt.current) }).catch(() => null);
      setBusy(false);
      if (!r?.ok) {
        setError("Couldn't save that review. Check your connection and try again.");
        return;
      }
      setRevealed(false);
      setQueue((q) => {
        const [first, ...rest] = q;
        // Re-show lapsed cards after a few others (≈ the 10-minute step), at most once more per session.
        if (r.again) rest.splice(Math.min(rest.length, 4), 0, { ...first, isNew: false });
        return rest;
      });
      if (!r.again) setDone((d) => d + 1);
    },
    [busy, card],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        const b = BUTTONS.find((x) => x.key === e.key);
        if (b) {
          e.preventDefault();
          void grade(b.grade);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, grade, revealed]);

  if (!card) {
    return (
      <div className="rounded-lg border border-[var(--c-border)] p-8 text-center">
        <p className="text-xl font-semibold">{done ? "Session complete" : "Nothing due right now"}</p>
        <p className="mt-2 text-muted">
          {done ? `You reviewed ${done} card${done === 1 ? "" : "s"}. ` : ""}Come back tomorrow; the schedule spaces reviews out as you
          learn.
        </p>
        <Link href="/flashcards" className="btn btn-primary mt-6">
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm text-muted" aria-live="polite">
        <span>{card.deckTitle}</span>
        {card.isNew ? <span className="badge">New</span> : null}
        <span className="ml-auto tabular-nums">
          {done} done · {queue.length} left
        </span>
      </p>
      <div className="flashcard">
        <span className="flashcard-label">Question</span>
        <div className="prose book-prose" dangerouslySetInnerHTML={{ __html: card.frontHtml }} />
        {revealed ? (
          <>
            <hr className="my-5 border-[var(--c-border)]" />
            <span className="flashcard-label">Answer</span>
            <div className="prose book-prose" dangerouslySetInnerHTML={{ __html: card.backHtml }} />
          </>
        ) : null}
      </div>
      {!revealed ? (
        <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => setRevealed(true)}>
          Show answer <span className="opacity-70">(Space)</span>
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember?">
          {BUTTONS.map((b) => (
            <button key={b.grade} type="button" disabled={busy} className={`btn grade-btn ${b.cls}`} onClick={() => grade(b.grade)}>
              <span>{b.label}</span>
              <span className="text-xs font-normal opacity-80">{intervals?.[b.grade] ?? " "}</span>
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--c-trap)]">
          {error}
        </p>
      ) : null}
      <p className="mt-3 hidden text-center text-xs text-muted sm:block">Keys: Space to reveal · 1 Again · 2 Hard · 3 Good · 4 Easy</p>
    </div>
  );
}
