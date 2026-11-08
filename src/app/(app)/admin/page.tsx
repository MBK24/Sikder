import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { TIERS } from "@/config/pricing";
import { WeeklyColumns } from "@/components/charts/WeeklyColumns";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const DAY = 86_400_000;
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-muted">Loading metrics…</p>}>
      <Metrics />
    </Suspense>
  );
}

/** All dashboard numbers in one place (kept out of the component so render stays pure). */
async function loadMetrics() {
  const now = Date.now();
  const since12w = new Date(now - 12 * 7 * DAY);
  const [totalUsers, users7, users30, subs, weekly, missed, openReports, pendingVerifications, activeToday, answered7] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
    db.user.count({ where: { createdAt: { gte: new Date(now - 30 * DAY) } } }),
    db.subscription.groupBy({ by: ["tier", "status", "interval"], where: { status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } }, _count: true }),
    db.$queryRaw<{ week: Date; n: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, count(*) AS n FROM "User" WHERE "createdAt" >= ${since12w} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ id: string; key: string; stem: string; n: bigint; pct: number }[]>`
      SELECT q.id, q.key, q.stem, count(*) AS n, avg(CASE WHEN a.correct THEN 1 ELSE 0 END)::float AS pct
      FROM "QuestionAttempt" a JOIN "Question" q ON q.id = a."questionId"
      WHERE a.selected IS NOT NULL
      GROUP BY q.id HAVING count(*) >= 5 ORDER BY pct ASC, n DESC LIMIT 10`,
    db.report.count({ where: { status: "OPEN" } }),
    db.verificationRequest.count({ where: { status: "PENDING" } }),
    db.studyDay.count({ where: { date: new Date(new Date().toISOString().slice(0, 10)) } }),
    db.questionAttempt.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
  ]);

  // MRR from list prices in config (annual ÷ 12). Trials aren't revenue yet; past-due still counts during grace.
  let mrr = 0;
  const byTier: Record<string, { trialing: number; active: number; pastDue: number }> = {};
  for (const s of subs) {
    const t = (byTier[s.tier] ??= { trialing: 0, active: 0, pastDue: 0 });
    if (s.status === "TRIALING") t.trialing += s._count;
    if (s.status === "ACTIVE") t.active += s._count;
    if (s.status === "PAST_DUE") t.pastDue += s._count;
    if (s.status !== "TRIALING") mrr += s._count * (s.interval === "YEAR" ? TIERS[s.tier].annualUsd / 12 : TIERS[s.tier].monthlyUsd);
  }
  const paying = Object.values(byTier).reduce((n, t) => n + t.active + t.pastDue, 0);
  const trialing = Object.values(byTier).reduce((n, t) => n + t.trialing, 0);

  const weeks: { week: string; value: number }[] = [];
  const monday = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  const start = monday(since12w);
  for (let i = 0; i < 12; i++) {
    const w = new Date(start.getTime() + (i + 1) * 7 * DAY).toISOString().slice(0, 10);
    weeks.push({ week: w, value: Number(weekly.find((r) => r.week.toISOString().slice(0, 10) === w)?.n ?? 0) });
  }

  return { mrr, byTier, paying, trialing, weeks, totalUsers, users7, users30, missed, openReports, pendingVerifications, activeToday, answered7 };
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

async function Metrics() {
  await connection();
  await requireRole("ADMIN");
  const { mrr, byTier, paying, trialing, weeks, totalUsers, users7, users30, missed, openReports, pendingVerifications, activeToday, answered7 } = await loadMetrics();

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      {openReports || pendingVerifications ? (
        <p className="mt-3 flex flex-wrap gap-3 text-sm">
          {openReports ? (
            <Link href="/admin/moderation" className="badge !border-[var(--c-trap)] !text-[var(--c-trap)]">
              {openReports} open report{openReports === 1 ? "" : "s"}
            </Link>
          ) : null}
          {pendingVerifications ? (
            <Link href="/admin/verifications" className="badge !border-[var(--c-hy)] !text-[var(--c-hy)]">
              {pendingVerifications} verification{pendingVerifications === 1 ? "" : "s"} to review
            </Link>
          ) : null}
        </p>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Est. MRR" value={usd(mrr)} sub="list prices, excl. trials" />
        <Tile label="Paying subscribers" value={String(paying)} />
        <Tile label="In trial" value={String(trialing)} />
        <Tile label="Users" value={totalUsers.toLocaleString()} sub={`+${users7} this week · +${users30} in 30 days`} />
        <Tile label="Studied today" value={String(activeToday)} />
        <Tile label="Questions answered" value={answered7.toLocaleString()} sub="last 7 days" />
      </dl>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="signups">
          <h2 id="signups" className="text-lg font-semibold">
            Signups per week
          </h2>
          <div className="mt-3">
            <WeeklyColumns data={weeks} label="Signups" />
          </div>
        </section>
        <section aria-labelledby="subs">
          <h2 id="subs" className="text-lg font-semibold">
            Active subscriptions by tier
          </h2>
          <table className="viz-table mt-3">
            <thead>
              <tr>
                <th>Tier</th>
                <th className="num">Trialing</th>
                <th className="num">Active</th>
                <th className="num">Past due</th>
              </tr>
            </thead>
            <tbody>
              {(["PREMIUM", "PREMIUM_TUTORING"] as const).map((t) => (
                <tr key={t}>
                  <td>{TIERS[t].name}</td>
                  <td className="num">{byTier[t]?.trialing ?? 0}</td>
                  <td className="num">{byTier[t]?.active ?? 0}</td>
                  <td className="num">{byTier[t]?.pastDue ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Actual revenue (discounts, taxes, refunds) is in the Stripe Dashboard.</p>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="missed">
        <h2 id="missed" className="text-lg font-semibold">
          Most-missed questions
        </h2>
        <p className="mt-1 text-sm text-muted">At least 5 answers, lowest accuracy first. Very low accuracy can mean a hard question, or a wrong key.</p>
        {missed.length ? (
          <table className="viz-table mt-3">
            <thead>
              <tr>
                <th>Question</th>
                <th className="num">Answers</th>
                <th className="num">Correct</th>
              </tr>
            </thead>
            <tbody>
              {missed.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/questions/${m.id}`} className="font-mono text-xs text-[var(--c-accent)] underline">
                      {m.key}
                    </Link>
                    <span className="ml-2 text-muted">{m.stem.replace(/\s+/g, " ").slice(0, 80)}</span>
                  </td>
                  <td className="num">{Number(m.n)}</td>
                  <td className="num">{Math.round(m.pct * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-muted">Not enough answers yet.</p>
        )}
      </section>
    </>
  );
}
