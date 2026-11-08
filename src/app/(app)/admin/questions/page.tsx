import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Questions", robots: { index: false } };
type SP = Promise<Record<string, string | string[] | undefined>>;
const PAGE = 50;

export default function QuestionsAdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: SP }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const part = typeof sp.part === "string" && ["CP", "CARS", "BB", "PS"].includes(sp.part) ? sp.part : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.QuestionWhereInput = {
    ...(part ? { part: part as "CP" } : {}),
    ...(q ? { OR: [{ key: { contains: q, mode: "insensitive" } }, { stem: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: [{ part: "asc" }, { key: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, key: true, part: true, stem: true, published: true, inBank: true, isFree: true, source: true, topic: { select: { code: true } } },
    }),
  ]);
  const stats = await db.questionAttempt.groupBy({
    by: ["questionId", "correct"],
    where: { questionId: { in: rows.map((r) => r.id) } },
    _count: true,
  });
  const statFor = (id: string) => {
    const s = stats.filter((x) => x.questionId === id);
    const n = s.reduce((a, b) => a + b._count, 0);
    const c = s.find((x) => x.correct)?._count ?? 0;
    return n ? `${Math.round((c / n) * 100)}% of ${n}` : "–";
  };
  const qs = (o: Record<string, string | number>) => {
    const u = new URLSearchParams({ ...(q ? { q } : {}), ...(part ? { part } : {}) });
    for (const [k, v] of Object.entries(o)) u.set(k, String(v));
    return `?${u}`;
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold tracking-tight">Questions</h1>
        <Link href="/admin/questions/new" className="btn btn-primary !py-1.5">
          New question
        </Link>
        <Link href="/admin/questions/import" className="btn btn-ghost !py-1.5">
          Import CSV
        </Link>
        <a href="/api/admin/questions.csv" className="btn btn-ghost !py-1.5">
          Export CSV
        </a>
      </div>
      <form className="mt-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search key or stem" className="input max-w-xs" aria-label="Search questions" />
        <select name="part" defaultValue={part} className="input max-w-[10rem]" aria-label="Section">
          <option value="">All sections</option>
          <option value="CP">Chem/Phys</option>
          <option value="CARS">CARS</option>
          <option value="BB">Bio/Biochem</option>
          <option value="PS">Psych/Soc</option>
        </select>
        <button className="btn btn-ghost">Filter</button>
      </form>
      <p className="mt-3 text-sm text-muted">{total} questions</p>
      <div className="table-wrap">
        <table className="viz-table min-w-[760px]">
          <thead>
            <tr>
              <th>Key</th>
              <th>Section</th>
              <th>Stem</th>
              <th className="num">Correct</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/questions/${r.id}`} className="font-mono text-xs text-[var(--c-accent)] underline">
                    {r.key}
                  </Link>
                </td>
                <td>
                  {r.part} {r.topic ? <span className="text-muted">{r.topic.code}</span> : null}
                </td>
                <td className="max-w-[24rem] truncate">{r.stem.replace(/\s+/g, " ").slice(0, 110)}</td>
                <td className="num">{statFor(r.id)}</td>
                <td className="space-x-1 text-xs">
                  {!r.published ? <span className="badge !text-[var(--c-trap)]">hidden</span> : null}
                  {r.inBank ? <span className="badge">bank</span> : <span className="badge">inline</span>}
                  {r.isFree ? <span className="badge">free</span> : null}
                  {r.source === "ADMIN" ? <span className="badge">admin</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > PAGE ? (
        <nav className="mt-4 flex justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link className="btn btn-ghost" href={qs({ page: page - 1 })}>← Previous</Link> : <span />}
          {page * PAGE < total ? <Link className="btn btn-ghost" href={qs({ page: page + 1 })}>Next →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
