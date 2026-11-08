"use client";

import { useCallback, useEffect, useState } from "react";

export interface FlipCard {
  id: string;
  frontHtml: string;
  backHtml: string;
}

/** Simple browse mode: flip through a deck. Available on every plan. */
export function CardFlipper({ cards }: { cards: FlipCard[] }) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[order[i]];

  const go = useCallback(
    (d: number) => {
      setI((x) => Math.min(cards.length - 1, Math.max(0, x + d)));
      setFlipped(false);
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!card) return <p className="text-muted">This deck has no cards yet.</p>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show front" : "Show answer"}
        className="flashcard w-full text-left"
      >
        <span className="flashcard-label">{flipped ? "Answer" : "Question"}</span>
        <span className="prose book-prose block" dangerouslySetInnerHTML={{ __html: flipped ? card.backHtml : card.frontHtml }} />
        {!flipped ? <span className="mt-6 block text-sm text-muted">Click or press Space to flip</span> : null}
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => go(-1)} disabled={i === 0}>
          ← Previous
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go(1)} disabled={i === cards.length - 1}>
          Next →
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOrder((o) => [...o].sort(() => Math.random() - 0.5));
            setI(0);
            setFlipped(false);
          }}
        >
          Shuffle
        </button>
        <span className="ml-auto text-sm tabular-nums text-muted">
          {i + 1} / {cards.length}
        </span>
      </div>
    </div>
  );
}
