import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { ForumListing } from "@/components/forum/ForumListing";

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Tagged “${(await params).tag}” · Forum` };
}

export default function TagPage(props: Props) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/forum" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Forum
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Tag {...props} />
      </Suspense>
    </div>
  );
}

async function Tag({ params, searchParams }: Props) {
  const slug = (await params).tag;
  const t = await db.tag.findUnique({ where: { slug } });
  if (!t) notFound();
  return (
    <>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        Tagged <span className="rounded bg-[var(--c-accent-soft)] px-2 text-[var(--c-accent)]">{t.name}</span>
      </h1>
      {t.description ? <p className="mt-1 text-muted">{t.description}</p> : null}
      <section className="mt-8">
        <ForumListing searchParams={searchParams} basePath={`/forum/t/${t.slug}`} filter={{ tagId: t.id }} empty="No questions with this tag yet." />
      </section>
    </>
  );
}
