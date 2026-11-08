"use client";

import { useState } from "react";

export interface HeatDay {
  date: string;
  questions: number;
  cards: number;
  minutes: number;
}

const CELL = 13;
const GAP = 3;
const LEVELS = [0, 1, 20, 50, 100]; // activity thresholds (questions + cards + minutes)
const DOW = ["Mon", "", "Wed", "", "Fri", "", ""];

function level(d: HeatDay) {
  const score = d.questions + d.cards + d.minutes;
  if (score <= 0) return 0;
  let l = 1;
  for (let i = 1; i < LEVELS.length; i++) if (score >= LEVELS[i]) l = i;
  return Math.min(4, l);
}

function fmt(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Calendar heatmap (weeks × weekdays), one-hue sequential ramp. Arrow keys move between days. */
export function ActivityHeatmap({ days }: { days: HeatDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Columns start on Monday; first day may be mid-week.
  const firstDow = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells = days.map((d, i) => ({ d, col: Math.floor((i + firstDow) / 7), row: (i + firstDow) % 7, i }));
  const cols = cells[cells.length - 1].col + 1;
  const left = 30;
  const width = left + cols * (CELL + GAP);
  const height = 7 * (CELL + GAP);
  const a = active !== null ? cells[active] : null;
  const activeDays = days.filter((d) => level(d) > 0).length;

  return (
    <div>
      <div
        className="relative overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]"
        tabIndex={0}
        role="img"
        aria-label={`Study activity calendar: ${activeDays} active days in the last ${days.length}. Use arrow keys to read each day.`}
        onFocus={() => setActive((x) => x ?? days.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
          if (step === undefined) return;
          e.preventDefault();
          setActive((x) => Math.max(0, Math.min(days.length - 1, (x ?? days.length - 1) + step)));
        }}
      >
        <svg width={width} height={height} className="block">
          {DOW.map((l, r) =>
            l ? (
              <text key={r} x={0} y={r * (CELL + GAP) + CELL - 2} fontSize={10} fill="var(--c-fg-muted)">
                {l}
              </text>
            ) : null,
          )}
          {cells.map(({ d, col, row, i }) => (
            <rect
              key={d.date}
              x={left + col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={`var(--viz-heat-${level(d)})`}
              stroke={active === i ? "var(--c-fg)" : "none"}
              strokeWidth={1.5}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        {a ? (
          <div
            className="viz-tooltip"
            role="status"
            style={{ left: Math.min(left + a.col * (CELL + GAP) - 40, width - 160), top: a.row * (CELL + GAP) + CELL + 6 }}
          >
            <strong>{fmt(a.d.date)}</strong>
            <span className="text-muted">
              {a.d.questions} questions · {a.d.cards} cards · {a.d.minutes} min reading
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="inline-block h-3 w-3 rounded-[3px]" style={{ background: `var(--viz-heat-${l})` }} />
        ))}
        More
      </div>
    </div>
  );
}
