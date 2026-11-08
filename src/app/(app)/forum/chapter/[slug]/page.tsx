import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { AskButton, ForumListing } from "@/components/forum/ForumListing";
import { CATEGORY_FOR_PART } from "@/server/forum-categories";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await db.chapter.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return c ? { title: `Discuss: ${c.title}`, description: `Questions and answers about ${c.title}.` } : {};
}

export default function ChapterDiscussion(props: Props) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Discussion {...props} />
      </Suspense>
    </div>
  );
}

async function Discussion({ params, searchParams }: Props) {
  const slug = (await params).slug;
  const chapter = await db.chapter.findUnique({ where: { slug }, select: { id: true, title: true, slug: true, part: true, number: true } });
  if (!chapter) notFound();
  const href = `/${ENUM_TO_CODE[chapter.part]}/${chapter.slug}`;
  return (
    <>
      <Link href={href} className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Back to the chapter
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Discuss this chapter</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{chapter.title}</h1>
        </div>
        <AskButton query={`?chapter=${chapter.slug}&category=${CATEGORY_FOR_PART[chapter.part]}`} />
      </div>
      <section className="mt-8">
        <ForumListing
          searchParams={searchParams}
          basePath={`/forum/chapter/${chapter.slug}`}
          filter={{ chapterId: chapter.id }}
          empty="No questions about this chapter yet. Stuck on something? Ask and a tutor will help."
        />
      </section>
    </>
  );
}
