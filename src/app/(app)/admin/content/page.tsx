import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { updateChapter } from "@/server/actions/admin";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Content", robots: { index: false } };

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));
const PART_ORDER = ["GETTING_STARTED", "CP", "CARS", "BB", "PS", "APPENDIX"];

export default function ContentAdminPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Chapters />
    </Suspense>
  );
}

async function Chapters() {
  await connection();
  await requireRole("ADMIN");
  const chapters = await db.chapter.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      part: true,
      number: true,
      access: true,
      status: true,
      earlyAccessUntil: true,
      _count: { select: { progress: { where: { completed: true } }, questions: true } },
    },
  });
  chapters.sort((a, b) => PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part) || a.number - b.number);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Content</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Changes apply to the live site immediately. Chapter text lives in <code>/content</code> and changes with a deploy; access and
        publishing are controlled here. Early access limits a chapter to Premium + Tutoring until the date you set.
      </p>
      <div className="table-wrap">
        <table className="viz-table min-w-[820px]">
          <thead>
            <tr>
              <th>Chapter</th>
              <th colSpan={4}>
                <span className="grid grid-cols-[7rem_9rem_10rem_1fr] gap-2">
                  <span>Access</span>
                  <span>Status</span>
                  <span>Early access until</span>
                  <span>Readers completed</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {chapters.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="mr-2 text-muted">
                    {c.part === "GETTING_STARTED" ? "GS" : c.part === "APPENDIX" ? "App" : c.part} {c.number}
                  </span>
                  <Link href={`/${ENUM_TO_CODE[c.part]}/${c.slug}`} className="hover:text-[var(--c-accent)]">
                    {c.title}
                  </Link>
                </td>
                <td colSpan={4} className="!p-0">
                  <form action={updateChapter} className="grid grid-cols-[7rem_9rem_10rem_1fr] items-center gap-2 px-2 py-1">
                    <input type="hidden" name="chapterId" value={c.id} />
                    <select name="access" defaultValue={c.access} className="input !py-1 text-sm" aria-label={`Access for ${c.title}`}>
                      <option value="FREE">Free</option>
                      <option value="PREMIUM">Premium</option>
                    </select>
                    <select name="status" defaultValue={c.status} className="input !py-1 text-sm" aria-label={`Status for ${c.title}`}>
                      <option value="PUBLISHED">Published</option>
                      <option value="COMING_SOON">Coming soon</option>
                      <option value="DRAFT">Draft (hidden)</option>
                    </select>
                    <input
                      type="date"
                      name="earlyAccessUntil"
                      defaultValue={c.earlyAccessUntil?.toISOString().slice(0, 10) ?? ""}
                      className="input !py-1 text-sm"
                      aria-label={`Early access end date for ${c.title}`}
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="tabular-nums text-muted">{c._count.progress}</span>
                      <button className="btn btn-ghost !px-2.5 !py-1 text-xs">Save</button>
                    </span>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
