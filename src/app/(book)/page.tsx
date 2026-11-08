import Link from "next/link";
import { getBook } from "@/server/content/book";
import { siteConfig } from "@/config/site";
import { MCAT_SECTIONS } from "@/config/mcat";
import { ContinueReading } from "@/components/book/ContinueReading";

export default function WelcomePage() {
  const book = getBook();
  const sections = book.filter((p) => p.prefix);
  const firstChapter = book[0]?.chapters[0];
  const published = book.reduce((n, p) => n + p.chapters.filter((c) => c.status === "published").length, 0);
  const planned = book.reduce((n, p) => n + p.comingSoon.length, 0);

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-12 sm:px-6">
      <header>
        <h1 className="font-serif text-[2.6rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">{siteConfig.name}</h1>
        <p className="mt-3 font-serif text-xl text-muted">{siteConfig.tagline}</p>
      </header>

      <ContinueReading />

      <div className="book-prose prose mt-10">
        <h2 id="welcome">Welcome</h2>
        <p>
          This is an online textbook for the MCAT, written to be <em>read</em>. Each chapter explains one area of the exam the
          way a good tutor would: what it is, why it works, how the test asks about it, and where students usually go wrong.
          Practice questions sit right next to the ideas they test, and every chapter ends with a short quiz.
        </p>
        <p>
          You can read the Getting Started part and the first chapter of every section for free, with no account required.
          Signing up (also free) saves your answers and progress so you can pick up where you left off on any device.
        </p>

        <h2 id="how-this-book-is-organized">How this book is organized</h2>
        <p>
          The book follows the exam. After a short <Link href="/getting-started">Getting Started</Link> part on scoring and study
          planning, there is one part for each of the four scored sections:
        </p>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {sections.map((p) => {
          const meta = MCAT_SECTIONS[p.code as keyof typeof MCAT_SECTIONS];
          return (
            <li key={p.code}>
              <Link
                href={p.href}
                className="group block h-full rounded-lg border border-[var(--c-border)] p-4 transition-colors hover:border-[var(--c-accent)]"
              >
                <span className="font-sans text-xs font-bold uppercase tracking-wide text-muted">
                  {p.label} · {p.short}
                </span>
                <span className="mt-1 block font-sans font-semibold leading-snug group-hover:text-[var(--c-accent)]">{p.title}</span>
                {meta ? (
                  <span className="mt-2 block font-sans text-sm text-muted">
                    {meta.questions} questions · {meta.minutes} minutes on test day
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="book-prose prose mt-8">
        <p>
          An <Link href="/appendix">Appendix</Link> collects the reference tables you&apos;ll want open while you study: equations,
          amino acids, hormones, and lab techniques. The book currently has {published} chapters, with {planned} more planned;
          upcoming chapters appear greyed-out in the sidebar.
        </p>

        <h2 id="conventions">Conventions</h2>
        <p>
          Chapters are numbered within each section, so <strong>CP 2.3</strong> means section 3 of chapter 2 in Chemical and
          Physical Foundations. Four kinds of boxes call out things worth slowing down for: <strong>High-Yield</strong> facts that
          the exam tests repeatedly, <strong>Common Traps</strong>, <strong>Mnemonics</strong>, and <strong>Connections</strong>{" "}
          to other sections of the test.
        </p>
        {firstChapter ? (
          <p>
            Ready? Start with <Link href={firstChapter.href}>{firstChapter.title}</Link>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
