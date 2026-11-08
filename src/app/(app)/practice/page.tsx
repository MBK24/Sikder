import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { db } from "@/server/db";
import { bankAccessWhere } from "@/server/practice";
import { FREE_QBANK_QUESTIONS } from "@/config/pricing";

export const metadata: Metadata = {
  title: "Practice",
  description: "MCAT question bank, timed practice sets, and full-length section tests with real MCAT timing.",
};

const MODES = [
  {
    href: "/practice/bank",
    title: "Question bank",
    body: "Browse every question by section, topic, difficulty, and whether you've seen it, gotten it right, or flagged it.",
  },
  {
    href: "/practice/new",
    title: "Build a practice set",
    body: "Pick sections, topics, and length. Go untimed to learn, or timed to build pacing.",
  },
  {
    href: "/practice/test",
    title: "Section test",
    body: "A full section under real conditions: same question count and time limit as test day.",
  },
];

export default function PracticeHub() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
      <p className="mt-2 max-w-prose font-serif text-lg text-muted">
        Reading builds understanding; questions build the skill of using it under time pressure. Mix both every week.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => (
          <li key={m.href}>
            <Link href={m.href} className="group block h-full rounded-lg border border-[var(--c-border)] p-5 hover:border-[var(--c-accent)]">
              <span className="font-semibold group-hover:text-[var(--c-accent)]">{m.title}</span>
              <span className="mt-1 block text-sm text-muted">{m.body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Suspense fallback={null}>
        <PracticeStatus />
      </Suspense>
    </div>
  );
}

async function PracticeStatus() {
  const session = await getSession();
  if (!session) {
    return (
      <p className="mt-10 rounded-lg border border-[var(--c-border)] p-5 text-sm">
        <Link href="/sign-up?next=/practice" className="font-semibold text-[var(--c-accent)] underline">
          Create a free account
        </Link>{" "}
        to practice {FREE_QBANK_QUESTIONS} questions and track your results.
      </p>
    );
  }
  const ent = await getEntitlement();
  const [available, recent] = await Promise.all([
    db.question.count({ where: bankAccessWhere(ent) }),
    db.practiceSet.findMany({
      where: { userId: session.user.id, status: { in: ["IN_PROGRESS", "SUBMITTED"] } },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, mode: true, status: true, startedAt: true, scoreCorrect: true, scoreTotal: true, chapter: { select: { title: true } } },
    }),
  ]);
  return (
    <>
      <p className="mt-6 text-sm text-muted">
        {available} questions available to you
        {can(ent, "qbank.full") ? "." : ` on the Free plan. Premium unlocks the full bank, timed sets, and section tests.`}
      </p>
      <section className="mt-10" aria-labelledby="recent">
        <h2 id="recent" className="text-xl font-semibold">
          Recent sets
        </h2>
        {recent.length ? (
          <ul className="mt-3 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={s.status === "IN_PROGRESS" ? `/practice/${s.id}` : `/practice/${s.id}/review`}
                  className="flex items-center gap-3 py-3 hover:text-[var(--c-accent)]"
                >
                  <span className="flex-1">
                    {s.mode === "CHAPTER_QUIZ" ? `Quiz: ${s.chapter?.title}` : s.mode === "SECTION_TEST" ? "Section test" : "Practice set"}
                    <span className="ml-2 text-sm text-muted">{s.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </span>
                  {s.status === "IN_PROGRESS" ? (
                    <span className="badge !border-[var(--c-hy)] !text-[var(--c-hy)]">Resume</span>
                  ) : (
                    <span className="tabular-nums text-sm">
                      {s.scoreCorrect}/{s.scoreTotal}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No sets yet. Build one above, or take an end-of-chapter quiz.</p>
        )}
      </section>
    </>
  );
}
