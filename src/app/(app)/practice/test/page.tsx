import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { db } from "@/server/db";
import { bankAccessWhere, PART_TO_CODE, SECTION_PARTS } from "@/server/practice";
import { startSectionTest } from "@/server/actions/practice";
import { MCAT_SECTIONS } from "@/config/mcat";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = { title: "Section test", robots: { index: false } };

export default function SectionTestPage() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Section test</h1>
      <p className="mt-2 max-w-prose font-serif text-lg text-muted">
        One full section under test-day conditions: the official question count and time limit, passages and discretes mixed the
        way the real exam mixes them, and no explanations until you submit.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Sections />
      </Suspense>
    </div>
  );
}

async function Sections() {
  await requireUser("/practice/test");
  const ent = await getEntitlement();
  const allowed = can(ent, "practice.sectionTest");
  const counts = await db.question.groupBy({ by: ["part"], where: bankAccessWhere(ent), _count: true });
  return (
    <>
      {!allowed ? (
        <div className="mt-6">
          <Upsell title="Section tests are part of Premium">Free accounts can build untimed practice sets from the sample questions.</Upsell>
        </div>
      ) : null}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {SECTION_PARTS.map((part) => {
          const spec = MCAT_SECTIONS[PART_TO_CODE[part]];
          const available = counts.find((c) => c.part === part)?._count ?? 0;
          const full = available >= spec.questions;
          const n = Math.min(available, spec.questions);
          const minutes = Math.round((spec.minutes * n) / spec.questions);
          return (
            <li key={part} className="flex flex-col rounded-lg border border-[var(--c-border)] p-5">
              <p className="font-semibold">{spec.label}</p>
              <p className="mt-1 text-sm text-muted">
                Test day: {spec.questions} questions · {spec.minutes} minutes
              </p>
              {!full && allowed ? (
                <p className="mt-2 text-sm text-[var(--c-hy)]">
                  The bank has {available} questions for this section so far, so this test will be {n} questions in {minutes} minutes
                  (the same pace as test day).
                </p>
              ) : null}
              <form action={startSectionTest} className="mt-auto pt-4">
                <input type="hidden" name="part" value={part} />
                <button type="submit" className="btn btn-primary" disabled={!allowed || n === 0}>
                  Start {minutes}-minute test
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
