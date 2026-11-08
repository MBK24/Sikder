import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import clsx from "clsx";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { db } from "@/server/db";
import { bankWhere, PART_LABEL, SECTION_PARTS, type BankFilters } from "@/server/practice";
import { Upsell } from "@/components/ui/Upsell";
import { FREE_QBANK_QUESTIONS } from "@/config/pricing";
import type { Difficulty, Part } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Question bank", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 25;
const STATUS = ["all", "unseen", "correct", "incorrect", "flagged"] as const;
const DIFFS = ["INTRO", "CORE", "ADVANCED"] as const;

function list(v: string | string[] | undefined) {
  return ([] as string[]).concat(v ?? []).filter(Boolean);
}

/** Markdown/LaTeX-light preview for list rows. */
function preview(md: string) {
  return md
    .replace(/\$\$[\s\S]*?\$\$/g, "[equation]")
    .replace(/\$([^$]+)\$/g, (_, m: string) => m.replace(/\\ce\{([^}]*)\}/g, "$1").replace(/\\[a-z]+/gi, "").replace(/[{}^_]/g, ""))
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 170);
}

export default function BankPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Question bank</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading questions…</p>}>
        <Bank searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Bank({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await getSession();
  const ent = await getEntitlement();
  const userId = session?.user.id ?? null;

  const filters: BankFilters = {
    parts: list(sp.part).filter((p): p is Part => (SECTION_PARTS as readonly string[]).includes(p)),
    topics: list(sp.topic).slice(0, 40),
    difficulties: list(sp.difficulty).filter((d): d is Difficulty => (DIFFS as readonly string[]).includes(d)),
    status: (STATUS as readonly string[]).includes(String(sp.status)) ? (sp.status as BankFilters["status"]) : "all",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const where = bankWhere(ent, userId, filters);

  const [total, rows, topics] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: [{ part: "asc" }, { key: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        key: true,
        part: true,
        stem: true,
        difficulty: true,
        passageId: true,
        topic: { select: { code: true, name: true } },
        userStatuses: userId ? { where: { userId }, select: { lastResult: true, flagged: true } } : false,
      },
    }),
    db.topic.findMany({ where: { part: { in: [...SECTION_PARTS] } }, orderBy: [{ part: "asc" }, { code: "asc" }] }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const u = new URLSearchParams();
    filters.parts?.forEach((p) => u.append("part", p));
    filters.topics?.forEach((t) => u.append("topic", t));
    filters.difficulties?.forEach((d) => u.append("difficulty", d));
    if (filters.status !== "all") u.set("status", filters.status!);
    for (const [k, v] of Object.entries(overrides)) u.set(k, String(v));
    return `?${u}`;
  };

  return (
    <>
      {!can(ent, "qbank.full") ? (
        <div className="mt-6">
          <Upsell title={`You're seeing the ${FREE_QBANK_QUESTIONS} free sample questions`} compact>
            Premium unlocks every question in the bank, plus timed sets and section tests.
          </Upsell>
        </div>
      ) : null}

      <form method="get" className="mt-6 grid gap-3 rounded-lg border border-[var(--c-border)] p-4 sm:grid-cols-4" aria-label="Filter questions">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Section</span>
          <select name="part" defaultValue={filters.parts?.[0] ?? ""} className="input">
            <option value="">All sections</option>
            {SECTION_PARTS.map((p) => (
              <option key={p} value={p}>
                {PART_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Topic</span>
          <select name="topic" defaultValue={filters.topics?.[0] ?? ""} className="input">
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code.replace("CARS-", "")} · {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Difficulty</span>
          <select name="difficulty" defaultValue={filters.difficulties?.[0] ?? ""} className="input">
            <option value="">Any</option>
            <option value="INTRO">Intro</option>
            <option value="CORE">Core</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Status</span>
          <select name="status" defaultValue={filters.status} className="input" disabled={!userId}>
            <option value="all">All</option>
            <option value="unseen">Unseen</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="btn btn-primary">
            Apply filters
          </button>
          <Link href="/practice/bank" className="btn btn-ghost">
            Reset
          </Link>
          {userId && total ? (
            <Link href={`/practice/new${qs({})}`} className="btn btn-ghost ml-auto">
              Practice these as a set →
            </Link>
          ) : null}
        </div>
      </form>

      <p className="mt-6 text-sm text-muted" role="status">
        {total} question{total === 1 ? "" : "s"}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>
      <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
        {rows.map((q) => {
          const st = Array.isArray(q.userStatuses) ? q.userStatuses[0] : undefined;
          const result = st?.lastResult ?? "UNSEEN";
          return (
            <li key={q.id}>
              <Link href={`/practice/question/${q.key}`} className="group flex gap-4 py-3">
                <span
                  className={clsx(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    result === "CORRECT" ? "bg-[var(--c-ok)]" : result === "INCORRECT" ? "bg-[var(--c-trap)]" : "border border-[var(--c-fg-muted)]",
                  )}
                  role="img"
                  aria-label={result === "UNSEEN" ? "Unseen" : result === "CORRECT" ? "Last answered correctly" : "Last answered incorrectly"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif group-hover:text-[var(--c-accent)]">{preview(q.stem)}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                    <span>{PART_LABEL[q.part as keyof typeof PART_LABEL]}</span>
                    {q.topic ? <span>· {q.topic.name}</span> : null}
                    <span>· {q.difficulty.toLowerCase()}</span>
                    {q.passageId ? <span>· passage</span> : null}
                    {st?.flagged ? <span className="text-[var(--c-hy)]">· ⚑ flagged</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link className="btn btn-ghost" href={`/practice/bank${qs({ page: page - 1 })}`}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link className="btn btn-ghost" href={`/practice/bank${qs({ page: page + 1 })}`}>
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
