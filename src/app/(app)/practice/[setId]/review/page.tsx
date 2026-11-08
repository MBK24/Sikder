import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import clsx from "clsx";
import { requireUser } from "@/server/auth";
import { loadReview } from "@/server/practice";
import { db } from "@/server/db";
import { FlagButton } from "@/components/practice/FlagButton";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

function secs(ms: number) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function ReviewPage({ params }: { params: Promise<{ setId: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-[860px] px-4 py-16 font-sans text-muted">Scoring…</p>}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const user = await requireUser(`/practice/${setId}/review`);
  const data = await loadReview(setId, user.id);
  if (!data) {
    const exists = await db.practiceSet.findFirst({ where: { id: setId, userId: user.id }, select: { status: true } });
    if (exists?.status === "IN_PROGRESS") redirect(`/practice/${setId}`);
    notFound();
  }
  const { set, items, passages, topics } = data;
  const correct = items.filter((i) => i.correct).length;
  const pct = items.length ? Math.round((correct / items.length) * 100) : 0;
  const totalMs = items.reduce((n, i) => n + i.timeSpentMs, 0);
  const avgMs = items.length ? totalMs / items.length : 0;
  const shownPassages = new Set<string>();
  const chapterHref = set.chapter ? `/${ENUM_TO_CODE[set.chapter.part]}/${set.chapter.slug}` : null;

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {set.mode === "CHAPTER_QUIZ" ? "Chapter quiz results" : set.mode === "SECTION_TEST" ? "Section test results" : "Practice set results"}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{set.chapter?.title ?? `${items.length}-question set`}</h1>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Score", `${correct} / ${items.length}`, `${pct}%`],
          ["Avg. time", secs(avgMs), "per question"],
          ["Total time", secs(totalMs), set.timeLimitSec ? `of ${Math.round(set.timeLimitSec / 60)} min` : "untimed"],
          set.scaledEstimate
            ? ["Rough estimate", String(set.scaledEstimate), "scaled, 118–132*"]
            : ["Answered", String(items.filter((i) => i.selected).length), `of ${items.length}`],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-[var(--c-border)] p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
            <dd className="text-xs text-muted">{sub}</dd>
          </div>
        ))}
      </dl>
      {set.scaledEstimate ? (
        <p className="mt-2 text-xs text-muted">
          *A rough linear mapping from percent correct. It is not how the AAMC scales the exam; use official practice tests for real
          score predictions.
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby="by-topic">
        <h2 id="by-topic" className="text-xl font-semibold">
          By topic
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--c-border)] text-left text-muted">
              <th className="py-2 font-semibold">Topic</th>
              <th className="py-2 text-right font-semibold">Correct</th>
              <th className="w-1/3 py-2 pl-4 font-semibold">
                <span className="sr-only">Accuracy</span>
              </th>
              <th className="py-2 text-right font-semibold">Avg. time</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t) => {
              const p = Math.round((t.correct / t.total) * 100);
              return (
                <tr key={t.code} className="border-b border-[var(--c-border)]">
                  <td className="py-2">
                    <span className="mr-2 text-muted">{t.code.replace("CARS-", "")}</span>
                    {t.name}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {t.correct}/{t.total}
                  </td>
                  <td className="py-2 pl-4">
                    <div className="h-2 rounded-full bg-[var(--c-bg-subtle)]" role="img" aria-label={`${p}% correct`}>
                      <div className="h-2 rounded-full bg-[var(--c-accent)]" style={{ width: `${p}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted">{secs(t.timeMs / t.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <nav aria-label="Jump to question" className="mt-10">
        <h2 className="text-xl font-semibold">Questions</h2>
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {items.map((it) => (
            <li key={it.questionId}>
              <a href={`#q${it.order}`} className={clsx("palette-btn grid place-items-center", it.correct ? "is-correct" : "is-incorrect")}>
                <span className="sr-only">Question </span>
                {it.order}
                <span className="sr-only">{it.correct ? " correct" : " incorrect"}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <ol className="mt-8 space-y-10">
        {items.map((it) => {
          const passage = it.passageId && !shownPassages.has(it.passageId) ? passages[it.passageId] : null;
          if (it.passageId) shownPassages.add(it.passageId);
          return (
            <li key={it.questionId} id={`q${it.order}`} className="scroll-mt-24">
              {passage ? (
                <details className="question-passage mb-4">
                  <summary>Passage{passage.title ? `: ${passage.title}` : ""}</summary>
                  <div className="prose book-prose !text-base" dangerouslySetInnerHTML={{ __html: passage.html }} />
                </details>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">Question {it.order}</span>
                <span className={clsx("badge", it.correct ? "!border-[var(--c-ok)] !text-[var(--c-ok)]" : "!border-[var(--c-trap)] !text-[var(--c-trap)]")}>
                  {it.correct ? "Correct" : it.selected ? "Incorrect" : "Unanswered"}
                </span>
                {it.topic ? <span className="text-muted">{it.topic.name}</span> : null}
                <span className="text-muted">· {secs(it.timeSpentMs)}</span>
                <span className="ml-auto">
                  <FlagButton questionId={it.questionId} initial={it.flagged} />
                </span>
              </div>
              <div className="prose book-prose mt-3 !text-[1.02rem]" dangerouslySetInnerHTML={{ __html: it.stemHtml }} />
              <ul className="mt-3 space-y-2">
                {it.choices.map((c) => (
                  <li
                    key={c.id}
                    className={clsx(
                      "choice !cursor-default",
                      c.id === it.answer && "choice-correct",
                      c.id === it.selected && !it.correct && "choice-incorrect",
                    )}
                  >
                    <span className="choice-letter">{c.id}</span>
                    <span className="flex-1">
                      <span className="choice-text block font-serif" dangerouslySetInnerHTML={{ __html: c.html }} />
                      {c.whyHtml ? <span className="prose mt-1 block text-sm text-muted" dangerouslySetInnerHTML={{ __html: c.whyHtml }} /> : null}
                    </span>
                    {c.id === it.selected ? <span className="text-xs font-semibold text-muted">Your answer</span> : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-md border-l-4 border-[var(--c-accent)] bg-[var(--c-bg-subtle)] px-4 py-3">
                <p className="text-sm font-semibold">Explanation</p>
                <div className="prose book-prose !text-base" dangerouslySetInnerHTML={{ __html: it.explanationHtml }} />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link href="/practice" className="btn btn-primary">
          Back to practice
        </Link>
        {chapterHref ? (
          <Link href={chapterHref} className="btn btn-ghost">
            Back to the chapter
          </Link>
        ) : null}
        <Link href="/practice/bank?status=incorrect" className="btn btn-ghost">
          Review my incorrect questions
        </Link>
      </div>
    </div>
  );
}
