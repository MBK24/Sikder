"use client";

import { useState } from "react";

export interface TopicBar {
  code: string;
  name: string;
  answered: number;
  correct: number;
}

/** Ranked horizontal bars, one hue, weakest first. Value printed at each bar's tip. */
export function TopicBars({ data, empty }: { data: TopicBar[]; empty: string }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!data.length) return <p className="rounded-lg border border-dashed border-[var(--c-border)] p-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <div>
      <ul className="space-y-2.5">
        {data.map((t) => {
          const pct = Math.round((t.correct / t.answered) * 100);
          return (
            <li
              key={t.code}
              className="relative grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3 text-sm"
              onPointerEnter={() => setHover(t.code)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(t.code)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${t.name}: ${pct}% correct, ${t.correct} of ${t.answered}`}
            >
              <span className="truncate">
                <span className="mr-1.5 text-muted">{t.code.replace("CARS-", "")}</span>
                {t.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r-[4px] bg-[var(--viz-series)] transition-opacity" style={{ width: `${Math.max(pct, 1)}%`, opacity: hover && hover !== t.code ? 0.45 : 1 }} />
                <span className="shrink-0 font-semibold tabular-nums">{pct}%</span>
              </span>
              {hover === t.code ? (
                <span className="viz-tooltip right-0 top-[-2.6rem]" role="status">
                  <strong>
                    {t.correct} of {t.answered}
                  </strong>
                  <span className="text-muted">answered correctly</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
