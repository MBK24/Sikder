import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { allChapterParams, getChapter } from "@/server/content/book";
import { renderChapter } from "@/server/content/render";
import { Toc } from "@/components/book/Toc";
import { ReadingProgress } from "@/components/book/ReadingProgress";
import { ChapterActions } from "@/components/book/ChapterActions";
import { PrevNext } from "@/components/book/PrevNext";
import { siteConfig } from "@/config/site";

type Params = { part: string; chapter: string };

export function generateStaticParams() {
  return allChapterParams();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  if (!c) return {};
  const title = c.nav.label ? `${c.nav.label}: ${c.nav.title}` : c.nav.title;
  return {
    title,
    description: c.nav.summary,
    alternates: { canonical: c.nav.href },
    openGraph: { type: "article", title, description: c.nav.summary, url: c.nav.href },
  };
}

const DIFFICULTY = { intro: "Introductory", core: "Core", advanced: "Advanced" } as const;

export default async function ChapterPage({ params }: { params: Promise<Params> }) {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  if (!c || c.nav.status === "draft") notFound();
  const { content, toc } = await renderChapter(c.file, Boolean(c.part.prefix));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.nav.title,
    description: c.nav.summary,
    isPartOf: { "@type": "Book", name: siteConfig.name },
    isAccessibleForFree: c.nav.access === "free",
    ...(c.nav.access === "premium"
      ? { hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".paywalled" } }
      : {}),
  };

  return (
    <>
      <ReadingProgress part={part} slug={chapter} />
      <div className="mx-auto flex max-w-[1180px] gap-10 px-4 sm:px-6 lg:px-10">
        <article id="chapter-body" className="min-w-0 max-w-[760px] flex-1 pb-24 pt-10">
          <nav aria-label="Breadcrumb" className="mb-3 font-sans text-sm text-muted">
            <Link href={c.part.href} className="hover:text-[var(--c-accent)]">
              {c.part.label === c.part.title ? c.part.title : `${c.part.label}: ${c.part.short}`}
            </Link>
          </nav>
          <header className="mb-8">
            <h1 className="font-sans text-[2.1rem] font-bold leading-tight tracking-tight sm:text-[2.5rem]">
              {c.nav.label ? <span className="mr-3 font-semibold text-muted">{c.nav.number}</span> : null}
              {c.nav.title}
            </h1>
            <p className="mt-3 font-serif text-lg text-muted">{c.nav.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 font-sans text-sm text-muted">
              <span>{c.nav.estReadMinutes} min read</span>
              <span aria-hidden>·</span>
              <span>{DIFFICULTY[c.nav.difficulty]}</span>
              <span aria-hidden>·</span>
              {c.nav.access === "free" ? <span className="badge">Free</span> : <span className="badge">Premium</span>}
            </div>
          </header>

          <Toc toc={toc} variant="inline" />

          <div className="book-prose prose">{content}</div>

          <ChapterActions part={part} slug={chapter} title={c.nav.title} />
          <PrevNext prev={c.prev} next={c.next} />
        </article>

        <aside className="no-print hidden w-[220px] shrink-0 xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pt-10">
            <Toc toc={toc} />
          </div>
        </aside>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
