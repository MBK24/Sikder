import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/server/db";
import { AskButton, ForumListing } from "@/components/forum/ForumListing";

export const metadata: Metadata = {
  title: "Forum",
  description: "Ask MCAT questions and get answers from verified tutors, MDs, and fellow students.",
};

type SP = Record<string, string | string[] | undefined>;

export default function ForumHome({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forum</h1>
          <p className="mt-2 max-w-prose font-serif text-lg text-muted">
            Ask about anything in the book or on the exam. Answers from <span className="role-badge role-tutor align-middle">Verified Tutors</span>{" "}
            and <span className="role-badge role-expert align-middle">Experts</span> are highlighted and shown first.
          </p>
        </div>
        <Suspense fallback={null}>
          <AskButton />
        </Suspense>
      </div>
      <Suspense fallback={<div className="mt-8 h-24" />}>
        <Categories />
      </Suspense>
      <section className="mt-10" aria-label="Questions">
        <Suspense fallback={<p className="text-muted">Loading questions…</p>}>
          <ForumListing searchParams={searchParams} basePath="/forum" filter={{}} empty="No questions yet. Be the first to ask!" />
        </Suspense>
      </section>
    </div>
  );
}

async function Categories() {
  const cats = await db.forumCategory.findMany({
    orderBy: { order: "asc" },
    select: { slug: true, name: true, description: true, _count: { select: { posts: { where: { status: { in: ["OPEN", "LOCKED"] } } } } } },
  });
  return (
    <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cats.map((c) => (
        <li key={c.slug}>
          <Link href={`/forum/c/${c.slug}`} className="group block h-full rounded-lg border border-[var(--c-border)] p-3 hover:border-[var(--c-accent)]">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold group-hover:text-[var(--c-accent)]">{c.name}</span>
              <span className="text-xs tabular-nums text-muted">{c._count.posts}</span>
            </span>
            <span className="mt-1 line-clamp-2 block text-xs text-muted">{c.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
