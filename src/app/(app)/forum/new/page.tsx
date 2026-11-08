import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getForumViewer } from "@/server/forum";
import { createPost } from "@/server/actions/forum";
import { PostForm } from "@/components/forum/PostForm";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = { title: "Ask a question", robots: { index: false } };
type SP = Record<string, string | string[] | undefined>;

export default function NewPostPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Ask a question</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <NewPost searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewPost({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("/forum/new");
  const sp = await searchParams;
  const viewer = (await getForumViewer())!;
  if (!viewer.premium) {
    return (
      <div className="mt-6">
        <Upsell title="Asking and answering is part of Premium">Free accounts can read every thread.</Upsell>
      </div>
    );
  }
  if (!viewer.verifiedEmail) {
    return <p className="mt-6 rounded-lg border border-[var(--c-border)] p-4">Please confirm your email address first. Check your inbox for the link we sent when you signed up.</p>;
  }
  const categories = await db.forumCategory.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } });
  const chapterSlug = typeof sp.chapter === "string" ? sp.chapter : undefined;
  const chapter = chapterSlug ? await db.chapter.findUnique({ where: { slug: chapterSlug }, select: { slug: true, title: true } }) : null;
  const anchor = typeof sp.anchor === "string" ? sp.anchor.slice(0, 200) : undefined;
  return (
    <div className="mt-6">
      <details className="mb-6 rounded-lg border border-[var(--c-border)] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Tips for a question that gets a great answer</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Search first. Someone may have asked already.</li>
          <li>Say what you expected and what actually happened (or which answer choice you picked and why).</li>
          <li>Don&apos;t paste questions from paid prep companies or the real exam; describe the concept instead.</li>
        </ul>
        <p className="mt-2">
          <Link href="/search" className="text-[var(--c-accent)] underline">
            Search the book and forum
          </Link>
        </p>
      </details>
      <PostForm
        action={createPost}
        categories={categories}
        initial={{ category: typeof sp.category === "string" ? sp.category : undefined }}
        chapter={chapter ? { ...chapter, anchor } : undefined}
        canMarkPriority={viewer.canMarkPriority}
        uploadsEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        userId={viewer.id}
        submitLabel="Post question"
      />
    </div>
  );
}
