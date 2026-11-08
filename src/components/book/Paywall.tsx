import Link from "next/link";
import { cacheLife } from "next/cache";
import { db } from "@/server/db";
import { can, getEntitlement } from "@/server/entitlements";
import { getChapter } from "@/server/content/book";
import { chapterSplit, renderMdx } from "@/server/content/render";
import { TIERS, TRIAL_DAYS } from "@/config/pricing";
import type { TocEntry } from "@/lib/content/mdx-plugins";

/**
 * The gated part of a premium chapter. Compiled once and cached ("use cache"),
 * but only ever rendered inside <GatedRest> after an entitlement check.
 */
async function ChapterRest({ part, slug }: { part: string; slug: string }) {
  "use cache";
  cacheLife("max");
  const c = getChapter(part, slug);
  if (!c) return null;
  const split = chapterSplit(c.file);
  const { content } = await renderMdx(split.rest, {
    chapterNumber: c.part.prefix ? c.file.number : undefined,
    startH2: split.previewH2Count,
    seedSlugs: split.previewSlugs,
  });
  return content;
}

/** Request-time access check. The rest of the chapter is sent only to readers who may see it. */
export async function GatedRest({ part, slug, remaining }: { part: string; slug: string; remaining: TocEntry[] }) {
  const [ent, chapter] = await Promise.all([
    getEntitlement(),
    db.chapter.findUnique({ where: { slug }, select: { access: true, earlyAccessUntil: true } }),
  ]);
  const early = chapter?.earlyAccessUntil && chapter.earlyAccessUntil > new Date();
  // The DB (admin toggle) is authoritative; if the row is missing, fail closed to Premium.
  const allowed = chapter?.access === "FREE" && !early ? true : can(ent, early ? "content.earlyAccess" : "content.premium");
  if (allowed)
    return (
      <div className="book-prose prose">
        <ChapterRest part={part} slug={slug} />
      </div>
    );
  return <PaywallGate signedIn={Boolean(ent.userId)} remaining={remaining} early={Boolean(early)} returnTo={`/${part}/${slug}`} />;
}

/** Deterministic filler shaped like prose. Never real content, so un-blurring reveals nothing. */
function FakeProse({ paragraphs = 6 }: { paragraphs?: number }) {
  const widths = [100, 96, 98, 92, 99, 64, 100, 94, 97, 88, 100, 71, 95, 99, 83];
  let k = 0;
  return (
    <div aria-hidden className="select-none space-y-6">
      {Array.from({ length: paragraphs }, (_, p) => (
        <div key={p} className="space-y-2.5">
          {p % 3 === 1 ? <div className="mb-4 h-6 w-1/2 rounded bg-[var(--c-border)]" /> : null}
          {Array.from({ length: 4 + (p % 3) }, () => {
            const w = widths[k++ % widths.length];
            return <div key={k} className="h-3.5 rounded bg-[var(--c-border)]" style={{ width: `${w}%` }} />;
          })}
        </div>
      ))}
    </div>
  );
}

export function PaywallSkeleton() {
  return (
    <div className="not-prose relative mt-8" aria-busy="true">
      <div className="opacity-60 blur-[2px]">
        <FakeProse paragraphs={3} />
      </div>
      <p className="sr-only">Loading the rest of the chapter…</p>
    </div>
  );
}

export function PaywallGate({ signedIn, remaining, early, returnTo }: { signedIn: boolean; remaining: TocEntry[]; early: boolean; returnTo: string }) {
  const sections = remaining.filter((t) => t.depth === 2);
  return (
    <section className="not-prose relative mt-8 font-sans" aria-labelledby="paywall-title">
      <div className="pointer-events-none max-h-[34rem] overflow-hidden blur-[5px]" style={{ maskImage: "linear-gradient(to bottom, black 30%, transparent 100%)" }}>
        <FakeProse />
      </div>
      <div className="absolute inset-x-0 top-10 mx-auto max-w-[520px] rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--c-accent)]">{early ? "Early access" : "Premium chapter"}</p>
        <h2 id="paywall-title" className="mt-1 text-xl font-bold">
          {early ? `This chapter is in early access for ${TIERS.PREMIUM_TUTORING.name}` : "Keep reading with Premium"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {sections.length
            ? `${sections.length} more section${sections.length === 1 ? "" : "s"}, with practice questions, a chapter quiz, and a flashcard deck.`
            : "The rest of this chapter, with practice questions and a quiz."}
        </p>
        {sections.length ? (
          <ol className="mt-3 space-y-1 text-sm">
            {sections.slice(0, 6).map((t) => (
              <li key={t.id} className="flex gap-2">
                <span className="w-8 shrink-0 tabular-nums text-muted">{t.number}</span>
                <span>{t.title}</span>
              </li>
            ))}
            {sections.length > 6 ? <li className="pl-10 text-muted">and {sections.length - 6} more</li> : null}
          </ol>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/pricing" className="btn btn-primary">
            Start {TRIAL_DAYS}-day free trial
          </Link>
          {!signedIn ? (
            <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`} className="text-sm font-semibold text-[var(--c-accent)] underline">
              Already subscribed? Sign in
            </Link>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted">Cancel anytime. The first chapter of every section is always free.</p>
      </div>
    </section>
  );
}
