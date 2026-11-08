import Link from "next/link";

/** Inline, non-blocking upgrade prompt. Never a hard redirect. */
export function Upsell({ title, children, compact = false }: { title: string; children?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-[var(--c-accent)] bg-[var(--c-accent-soft)] font-sans ${compact ? "p-4" : "p-6"}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/pricing" className="btn btn-primary !py-1.5">
          See Premium
        </Link>
      </div>
    </div>
  );
}
