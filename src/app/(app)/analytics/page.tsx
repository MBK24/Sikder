import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { getAnalytics, sampleAnalytics, READINESS_WEIGHTS, SECTION_NAME, type Analytics } from "@/server/analytics";
import { AccuracyLine } from "@/components/charts/AccuracyLine";
import { TopicBars } from "@/components/charts/TopicBars";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { Meter } from "@/components/charts/Meter";
import { Upsell } from "@/components/ui/Upsell";
import { MCAT_SECTIONS } from "@/config/mcat";

export const metadata: Metadata = { title: "My progress", robots: { index: false } };

const CODE = { CP: "cp", CARS: "cars", BB: "bb", PS: "ps" } as const;

function secs(ms: number | null) {
  if (ms === null) return "–";
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">My progress</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Crunching your numbers…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const user = await requireUser("/analytics");
  const ent = await getEntitlement();
  const premium = can(ent, "analytics");
  const a = premium ? await getAnalytics(user.id) : sampleAnalytics();
  return (
    <>
      {!premium ? (
        <div className="mt-6">
          <Upsell title="This is sample data">
            Premium turns this page into your own dashboard: accuracy by topic over time, pacing, your weakest areas, study
            streak, and a readiness estimate for each section.
          </Upsell>
        </div>
      ) : null}
      <div className={a.sample ? "pointer-events-none select-none opacity-70" : ""} aria-hidden={a.sample || undefined}>
        <Body a={a} />
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--c-border)] p-4">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      {sub ? <dd className="text-xs text-muted">{sub}</dd> : null}
    </div>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Body({ a }: { a: Analytics }) {
  const acc = a.totals.answered ? Math.round((a.totals.correct / a.totals.answered) * 100) : null;
  const weakest = a.topics
    .filter((t) => t.answered >= 3)
    .sort((x, y) => x.correct / x.answered - y.correct / y.answered)
    .slice(0, 8);

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Questions answered" value={a.totals.answered.toLocaleString()} />
        <Tile label="Accuracy" value={acc !== null ? `${acc}%` : "–"} sub={a.totals.answered ? `${a.totals.correct.toLocaleString()} correct` : undefined} />
        <Tile label="Time per question" value={secs(a.totals.avgTimeMs)} sub="test day ≈ 1m 36s" />
        <Tile label="Study streak" value={`${a.streak.current} day${a.streak.current === 1 ? "" : "s"}`} sub={`longest ${a.streak.longest}`} />
        <Tile label="Cards reviewed" value={a.totals.cardsReviewed.toLocaleString()} />
        <Tile label="Chapters completed" value={String(a.totals.chaptersDone)} sub={`${Math.round(a.totals.minutesReading / 60)}h reading`} />
      </dl>

      <Section id="readiness" title="Readiness by section" sub="A rough guide to where to spend your time, not a score prediction.">
        <ul className="divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
          {a.sections.map((s) => (
            <li key={s.part} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr_6rem] sm:items-center">
              <span className="font-semibold">{SECTION_NAME[s.part]}</span>
              <span>
                <Meter value={s.readiness} label={`${SECTION_NAME[s.part]} readiness`} />
                <span className="mt-1.5 block text-xs text-muted">
                  {s.recentAccuracy !== null ? `${Math.round(s.recentAccuracy * 100)}% recent accuracy` : "No questions yet"} ·{" "}
                  {Math.round(s.coverage * 100)}% of topics practiced · {s.chaptersDone}/{s.chaptersTotal} chapters read
                </span>
              </span>
              <span className="sm:text-right">
                <span className="text-lg font-semibold">{s.readiness}</span>
                <span className="text-sm text-muted">/100</span>
                <span className="block text-xs text-muted">{s.scaledBand ? `≈ ${s.scaledBand[0]}–${s.scaledBand[1]}` : "need ~30 questions"}</span>
              </span>
            </li>
          ))}
        </ul>
        <details className="mt-3 text-sm text-muted">
          <summary className="cursor-pointer">How this is calculated</summary>
          <p className="mt-2 max-w-prose">
            Readiness = {READINESS_WEIGHTS.accuracy * 100}% your accuracy on your last 100 questions in that section +{" "}
            {READINESS_WEIGHTS.coverage * 100}% the share of the section&apos;s topics you&apos;ve practiced at least three times +{" "}
            {READINESS_WEIGHTS.reading * 100}% the share of its chapters you&apos;ve completed. The score range appears after about 30
            questions and is a simple mapping from percent correct; the AAMC&apos;s own scaling differs from form to form, so treat
            official practice tests as the real benchmark.
          </p>
        </details>
      </Section>

      <Section id="trend" title="Accuracy over time" sub="Percent correct each week, across every question you answered.">
        <AccuracyLine data={a.weeks} />
      </Section>

      <Section id="weakest" title="Weakest areas" sub="Topics where you've answered at least three questions, lowest accuracy first.">
        <TopicBars data={weakest} empty="Answer at least three questions in a topic to see it here." />
        {a.topics.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted">All topics</summary>
            <table className="viz-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th className="num">Answered</th>
                  <th className="num">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {[...a.topics]
                  .sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))
                  .map((t) => (
                    <tr key={t.code}>
                      <td>
                        <span className="mr-1.5 text-muted">{t.code.replace("CARS-", "")}</span>
                        {t.name}
                      </td>
                      <td className="num">{t.answered}</td>
                      <td className="num">{Math.round((t.correct / t.answered) * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        ) : null}
        {weakest.length && !a.sample ? (
          <p className="mt-4 text-sm">
            <Link className="font-semibold text-[var(--c-accent)] underline" href={`/practice/new?status=incorrect`}>
              Practice the questions you missed →
            </Link>
          </p>
        ) : null}
      </Section>

      <Section id="pacing" title="Pacing" sub="Average time per question in practice sets, quizzes, and tests, against test-day pace.">
        <table className="viz-table">
          <thead>
            <tr>
              <th>Section</th>
              <th className="num">Answered</th>
              <th className="num">Your pace</th>
              <th className="num">Test-day pace</th>
            </tr>
          </thead>
          <tbody>
            {a.sections.map((s) => {
              const spec = MCAT_SECTIONS[CODE[s.part]];
              const target = (spec.minutes * 60_000) / spec.questions;
              const slow = s.avgTimeMs !== null && s.avgTimeMs > target * 1.1;
              return (
                <tr key={s.part}>
                  <td>{SECTION_NAME[s.part]}</td>
                  <td className="num">{s.answered}</td>
                  <td className="num">
                    {secs(s.avgTimeMs)}
                    {slow ? <span className="ml-1 text-xs text-[var(--c-hy)]">(slow)</span> : null}
                  </td>
                  <td className="num text-muted">{secs(target)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section id="activity" title="Study activity" sub="Questions, flashcards, and reading time per day over the last 16 weeks.">
        <ActivityHeatmap days={a.days} />
      </Section>
    </>
  );
}
