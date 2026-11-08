"use client";

import { useState } from "react";

/** Single-series weekly column chart with hover/focus tooltip and a table view. */
export function WeeklyColumns({ data, label }: { data: { week: string; value: number }[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (w: string) => new Date(`${w}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = data[data.length - 1];
  return (
    <div>
      <div
        className="relative flex h-40 items-end gap-[2px] border-b border-[var(--viz-axis)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]"
        tabIndex={0}
        role="img"
        aria-label={`${label} per week for the last ${data.length} weeks; most recent week ${last?.value ?? 0}. Use arrow keys to read each week.`}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? data.length) - 1));
        }}
      >
        {data.map((d, i) => (
          <div key={d.week} className="flex h-full flex-1 items-end" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}>
            <div
              className="w-full max-w-6 rounded-t-[4px] bg-[var(--viz-series)] transition-opacity"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, opacity: active !== null && active !== i ? 0.45 : 1 }}
            />
          </div>
        ))}
        {active !== null ? (
          <div className="viz-tooltip" style={{ left: `min(calc(${(active / data.length) * 100}% - 2rem), calc(100% - 9rem))`, top: 0 }} role="status">
            <strong>{data[active].value.toLocaleString()}</strong>
            <span className="text-muted">week of {fmt(data[active].week)}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{data[0] ? fmt(data[0].week) : ""}</span>
        <span>{last ? fmt(last.week) : ""}</span>
      </div>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="viz-table">
          <tbody>
            {data.map((d) => (
              <tr key={d.week}>
                <td>Week of {fmt(d.week)}</td>
                <td className="num">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
