/** A single value against 0–100, with a same-hue track. */
export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label} className="h-2 w-full rounded-full bg-[var(--viz-track)]">
      <div className="h-2 rounded-full bg-[var(--viz-series)]" style={{ width: `${v}%` }} />
    </div>
  );
}
