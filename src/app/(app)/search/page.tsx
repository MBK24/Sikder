import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { searchBook } from "@/server/search";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

/** Escapes everything except the <mark> tags produced by ts_headline. */
function safeSnippet(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="font-sans text-3xl font-bold tracking-tight">Search</h1>
      <Suspense fallback={<SearchForm q="" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SearchForm({ q }: { q: string }) {
  return (
    <form action="/search" role="search" className="mt-6 flex gap-2 font-sans">
      <label htmlFor="q" className="sr-only">
        Search the book
      </label>
      <input id="q" name="q" type="search" defaultValue={q} placeholder="e.g. Henderson-Hasselbalch, signal detection" className="input" autoFocus />
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q ?? "";
  const hits = q ? await searchBook(q) : [];
  return (
    <>
      <SearchForm q={q} />
      {q ? (
        <p className="mt-6 font-sans text-sm text-muted" role="status">
          {hits.length ? `${hits.length} result${hits.length === 1 ? "" : "s"} in the book` : `No results for “${q}”.`}
        </p>
      ) : null}
      <ol className="mt-4 divide-y divide-[var(--c-border)]">
        {hits.map((h) => (
          <li key={h.href} className="py-4">
            <Link href={h.href} className="group block">
              <span className="font-sans text-xs text-muted">{h.chapterTitle}</span>
              <span className="block font-sans font-semibold group-hover:text-[var(--c-accent)]">
                {h.number ? <span className="mr-2 text-muted">{h.number}</span> : null}
                {h.heading}
                {h.premium ? <span className="badge ml-2 align-middle">Premium</span> : null}
              </span>
              <span className="search-snippet mt-1 block font-serif text-[0.98rem] text-muted" dangerouslySetInnerHTML={{ __html: safeSnippet(h.snippet) }} />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
