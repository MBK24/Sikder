import Link from "next/link";

export function ChapterQuizCard({ href, count }: { href: string; count: number }) {
  if (!count) return null;
  return (
    <div className="no-print mt-14 flex flex-col gap-3 rounded-lg border border-[var(--c-accent)] p-5 font-sans sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-semibold">Test yourself</p>
        <p className="text-sm text-muted">
          A {count}-question end-of-chapter quiz with a per-topic breakdown. Untimed; explanations after you submit.
        </p>
      </div>
      <Link href={href} className="btn btn-primary">
        Take the quiz
      </Link>
    </div>
  );
}
