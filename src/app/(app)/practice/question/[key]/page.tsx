import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { db } from "@/server/db";
import { PART_LABEL, type StoredChoice } from "@/server/practice";
import { inlineMarkdownToHtml, markdownToHtml } from "@/lib/content/markdown";
import { QuestionCard } from "@/components/mdx/QuestionCard";
import { FlagButton } from "@/components/practice/FlagButton";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = { title: "Practice question", robots: { index: false } };

export default function QuestionPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/practice/bank" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Question bank
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Q params={params} />
      </Suspense>
    </div>
  );
}

async function Q({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = await db.question.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      part: true,
      stem: true,
      choices: true,
      isFree: true,
      inBank: true,
      published: true,
      topic: { select: { name: true } },
      passage: { select: { title: true, body: true } },
    },
  });
  if (!q || !q.published || !q.inBank) notFound();
  const ent = await getEntitlement();
  if (!q.isFree && !can(ent, "qbank.full")) {
    return (
      <div className="mt-8 max-w-[680px]">
        <Upsell title="This question is in the Premium question bank">Free accounts can practice the sample questions marked in the bank.</Upsell>
      </div>
    );
  }
  const session = await getSession();
  const status = session
    ? await db.userQuestionStatus.findUnique({ where: { userId_questionId: { userId: session.user.id, questionId: q.id } }, select: { flagged: true } })
    : null;
  const choices = q.choices as unknown as StoredChoice[];
  const card = (
    <QuestionCard
      context="PRACTICE"
      questionKey={q.key}
      stemHtml={markdownToHtml(q.stem)}
      choices={choices.map((c) => ({ id: c.id, html: inlineMarkdownToHtml(c.text) }))}
    />
  );
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{PART_LABEL[q.part as keyof typeof PART_LABEL]}</span>
        {q.topic ? <span>· {q.topic.name}</span> : null}
        {session ? (
          <span className="ml-auto">
            <FlagButton questionId={q.id} initial={status?.flagged ?? false} />
          </span>
        ) : null}
      </div>
      {q.passage ? (
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <section aria-label="Passage" className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Passage{q.passage.title ? `: ${q.passage.title}` : ""}</p>
            <div className="prose book-prose !text-[1.02rem]" dangerouslySetInnerHTML={{ __html: markdownToHtml(q.passage.body) }} />
          </section>
          <div className="book-prose">{card}</div>
        </div>
      ) : (
        <div className="book-prose mx-auto max-w-[760px]">{card}</div>
      )}
    </>
  );
}
