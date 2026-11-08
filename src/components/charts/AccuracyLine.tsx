"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface AccuracyPoint {
  week: string;
  answered: number;
  correct: number;
}

const H = 220;
const PAD = { top: 16, right: 44, bottom: 28, left: 40 };

function label(week: string) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Weekly accuracy, one series, crosshair + tooltip; weeks with no questions leave a gap. */
export function AccuracyLine({ data }: { data: AccuracyPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - v) * innerH;
  const pts = data.map((d, i) => ({ ...d, i, acc: d.answered ? d.correct / d.answered : null }));

  const path = useMemo(() => {
    let dStr = "";
    let pen = false;
    for (const p of pts) {
      if (p.acc === null) {
        pen = false;
        continue;
      }
      dStr += `${pen ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.acc).toFixed(1)}`;
      pen = true;
    }
    return dStr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, w]);

  const last = [...pts].reverse().find((p) => p.acc !== null);
  const hv = hover !== null ? pts[hover] : null;
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70)));

  function nearest(clientX: number) {
    const rect = wrap.current!.getBoundingClientRect();
    const rel = clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(data.length - 1, Math.round((rel / innerW) * (data.length - 1))));
  }

  if (!pts.some((p) => p.acc !== null)) {
    return <p className="rounded-lg border border-dashed border-[var(--c-border)] p-6 text-center text-sm text-muted">Answer a few questions to see your accuracy trend.</p>;
  }

  return (
    <div>
      <div
        ref={wrap}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]"
        tabIndex={0}
        role="img"
        aria-label={`Weekly accuracy over the last ${data.length} weeks${last ? `; most recent ${Math.round(last.acc! * 100)}%` : ""}. Use arrow keys to read each week.`}
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? (last?.i ?? 0))}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
        }}
      >
        <svg width={w} height={H} className="block">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--c-fg-muted)" className="tabular-nums">
                {t * 100}%
              </text>
            </g>
          ))}
          {pts.map((p) =>
            p.i % labelEvery === 0 || p.i === data.length - 1 ? (
              <text key={p.week} x={x(p.i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--c-fg-muted)">
                {label(p.week)}
              </text>
            ) : null,
          )}
          {hv ? <line x1={x(hv.i)} x2={x(hv.i)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--viz-axis)" strokeWidth={1} /> : null}
          <path d={path} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p) =>
            p.acc !== null ? (
              <circle
                key={p.week}
                cx={x(p.i)}
                cy={y(p.acc)}
                r={hv?.i === p.i ? 5 : 3}
                fill="var(--viz-series)"
                stroke="var(--c-bg)"
                strokeWidth={2}
              />
            ) : null,
          )}
          {last ? (
            <text x={x(last.i) + 8} y={y(last.acc!)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--c-fg)">
              {Math.round(last.acc! * 100)}%
            </text>
          ) : null}
        </svg>
        {hv ? (
          <div
            className="viz-tooltip"
            style={{ left: Math.min(Math.max(x(hv.i) - 64, 0), w - 150), top: hv.acc !== null ? Math.max(0, y(hv.acc) - 72) : 8 }}
            role="status"
          >
            <strong>{hv.acc !== null ? `${Math.round(hv.acc * 100)}%` : "No questions"}</strong>
            <span className="text-muted">
              Week of {label(hv.week)}
              {hv.answered ? ` · ${hv.correct}/${hv.answered} correct` : ""}
            </span>
          </div>
        ) : null}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="viz-table">
          <thead>
            <tr>
              <th>Week of</th>
              <th className="num">Answered</th>
              <th className="num">Correct</th>
              <th className="num">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p) => (
              <tr key={p.week}>
                <td>{label(p.week)}</td>
                <td className="num">{p.answered}</td>
                <td className="num">{p.correct}</td>
                <td className="num">{p.acc !== null ? `${Math.round(p.acc * 100)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
