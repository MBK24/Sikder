import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allChapterParams, getChapter, getChapterQuizInfo } from "@/server/content/book";
import { startChapterQuiz } from "@/server/actions/practice";
import { TOPICS } from "@/lib/content/topics";

/** Fully prerendered per URL (static book content), so navigation waits for the page rather than showing a shell. */
export const instant = false;

type Params = { part: string; chapter: string };

export function generateStaticParams() {
  return allChapterParams().filter((p) => getChapterQuizInfo(p.part, p.chapter).count > 0);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  return c ? { title: `Quiz: ${c.nav.title}`, robots: { index: false } } : {};
}

export default async function QuizIntroPage({ params }: { params: Promise<Params> }) {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  const info = getChapterQuizInfo(part, chapter);
  if (!c || !info.count) notFound();
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-24 pt-12 font-sans sm:px-6">
      <Link href={c.nav.href} className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← {c.nav.label ? `${c.nav.label} ` : ""}
        {c.nav.title}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">End-of-chapter quiz</h1>
      <p className="mt-3 font-serif text-lg text-muted">
        {info.count} questions on {c.nav.title}. There&apos;s no timer. Answer everything, then submit to see your score, a
        breakdown by topic, and a full explanation for every question.
      </p>
      <ul className="mt-6 space-y-1 text-sm">
        {info.topics.map((code) => (
          <li key={code}>
            <span className="mr-2 text-muted">{code.replace("CARS-", "")}</span>
            {TOPICS.find((t) => t.code === code)?.name ?? code}
          </li>
        ))}
      </ul>
      <form action={startChapterQuiz} className="mt-8">
        <input type="hidden" name="part" value={part} />
        <input type="hidden" name="slug" value={chapter} />
        <button type="submit" className="btn btn-primary">
          Start the quiz
        </button>
        {c.nav.access === "premium" ? <p className="mt-3 text-sm text-muted">This quiz is part of a Premium chapter.</p> : null}
      </form>
    </div>
  );
}
