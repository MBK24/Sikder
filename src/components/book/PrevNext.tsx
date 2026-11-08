import Link from "next/link";
import type { NavChapter } from "@/server/content/book";

export function PrevNext({ prev, next }: { prev: NavChapter | null; next: NavChapter | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Chapter navigation" className="no-print mt-10 grid gap-3 border-t border-[var(--c-border)] pt-6 font-sans sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} rel="prev" className="pager group">
          <span className="text-xs text-muted">← Previous</span>
          <span className="font-semibold group-hover:text-[var(--c-accent)]">
            {prev.label ? `${prev.label} ` : ""}
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} rel="next" className="pager group sm:text-right">
          <span className="text-xs text-muted">Next →</span>
          <span className="font-semibold group-hover:text-[var(--c-accent)]">
            {next.label ? `${next.label} ` : ""}
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
