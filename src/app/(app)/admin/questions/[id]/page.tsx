import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { questionToFields } from "@/server/admin-questions";
import { QuestionForm, type QuestionFields } from "@/components/admin/QuestionForm";

export const metadata: Metadata = { title: "Edit question", robots: { index: false } };

const BLANK: QuestionFields = {
  key: "", part: "CP", topic: "", difficulty: "CORE", chapter: "", passage: "", stem: "", a: "", b: "", c: "", d: "", answer: "",
  explanation: "", why_a: "", why_b: "", why_c: "", why_d: "", in_bank: true, is_free: false, published: true,
};

export default function EditQuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  return (
    <>
      <Link href="/admin/questions" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Questions
      </Link>
      <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { saved } = await searchParams;
  const isNew = id === "new";
  const q = isNew
    ? null
    : await db.question.findUnique({
        where: { id },
        include: { topic: { select: { code: true } }, chapter: { select: { slug: true } }, passage: { select: { key: true } } },
      });
  if (!isNew && !q) notFound();
  const [topics, chapters] = await Promise.all([
    db.topic.findMany({ orderBy: [{ part: "asc" }, { code: "asc" }], select: { code: true, name: true } }),
    db.chapter.findMany({ orderBy: [{ part: "asc" }, { number: "asc" }], select: { slug: true, title: true } }),
  ]);
  return (
    <>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{isNew ? "New question" : "Edit question"}</h1>
      {saved ? <p role="status" className="mt-2 text-sm text-[var(--c-ok)]">Saved.</p> : null}
      {q?.source === "CONTENT" ? (
        <p className="mt-2 rounded-md bg-[var(--c-hy-bg)] px-3 py-2 text-sm">
          This question comes from the content files. Saving here makes it admin-managed, so future content syncs won&apos;t overwrite
          your changes.
        </p>
      ) : null}
      <div className="mt-6">
        <QuestionForm questionId={q?.id ?? null} initial={q ? questionToFields(q) : BLANK} topics={topics} chapters={chapters} />
      </div>
    </>
  );
}
