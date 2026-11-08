import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { AskButton, ForumListing } from "@/components/forum/ForumListing";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await db.forumCategory.findUnique({ where: { slug: (await params).category } });
  return c ? { title: `${c.name} · Forum`, description: c.description ?? undefined } : {};
}

export default function CategoryPage(props: Props) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/forum" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Forum
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Category {...props} />
      </Suspense>
    </div>
  );
}

async function Category({ params, searchParams }: Props) {
  const slug = (await params).category;
  const c = await db.forumCategory.findUnique({ where: { slug } });
  if (!c) notFound();
  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
          {c.description ? <p className="mt-1 text-muted">{c.description}</p> : null}
        </div>
        <AskButton query={`?category=${c.slug}`} />
      </div>
      <section className="mt-8">
        <ForumListing searchParams={searchParams} basePath={`/forum/c/${c.slug}`} filter={{ categoryId: c.id }} empty="No questions in this category yet." />
      </section>
    </>
  );
}
