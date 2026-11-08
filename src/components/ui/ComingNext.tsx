import Link from "next/link";

/** Temporary page for features that land in a later build phase. */
export function ComingNext({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-24 pt-14 sm:px-6">
      <p className="badge">In progress</p>
      <h1 className="mt-3 font-sans text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-4 font-serif text-lg leading-relaxed text-muted">{children}</div>
      <Link href="/" className="btn btn-ghost mt-8">
        ← Back to the book
      </Link>
    </div>
  );
}
