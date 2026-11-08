import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getPart } from "@/server/content/book";

type Params = { part: string };

export function generateStaticParams() {
  return getBook().map((p) => ({ part: p.code }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const part = getPart((await params).part);
  return part ? { title: part.title, description: part.intro, alternates: { canonical: part.href } } : {};
}

export default async function PartPage({ params }: { params: Promise<Params> }) {
  const part = getPart((await params).part);
  if (!part) notFound();
  const chapters = part.chapters.filter((c) => c.status !== "draft");
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 sm:px-6">
      <p className="font-sans text-sm font-semibold uppercase tracking-wide text-muted">{part.label}</p>
      <h1 className="mt-1 font-sans text-[2.1rem] font-bold leading-tight tracking-tight">{part.title}</h1>
      <p className="mt-4 font-serif text-lg leading-relaxed">{part.intro}</p>

      <ol className="mt-10 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
        {chapters.map((c) => (
          <li key={c.slug}>
            <Link href={c.href} className="group flex gap-4 py-5">
              {c.label ? <span className="w-12 shrink-0 font-sans text-lg font-semibold text-muted">{c.number}</span> : null}
              <span className="flex-1">
                <span className="block font-sans text-lg font-semibold group-hover:text-[var(--c-accent)]">{c.title}</span>
                <span className="mt-1 block font-serif text-[0.98rem] text-muted">{c.summary}</span>
                <span className="mt-2 flex gap-2 font-sans text-xs text-muted">
                  <span>{c.estReadMinutes} min</span>
                  <span aria-hidden>·</span>
                  <span>{c.access === "free" ? "Free" : "Premium"}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
        {part.comingSoon.map((c, i) => (
          <li key={c.title} className="flex gap-4 py-4 text-muted">
            {part.prefix ? <span className="w-12 shrink-0 font-sans text-lg">{chapters.length + i + 1}</span> : null}
            <span className="flex-1 font-sans">
              {c.title} <span className="ml-2 badge">Coming soon</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
