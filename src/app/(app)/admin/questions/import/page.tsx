import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { ImportForm } from "@/components/admin/ImportForm";
import { CSV_COLUMNS } from "@/server/admin-questions";

export const metadata: Metadata = { title: "Import questions", robots: { index: false } };

export default function ImportPage() {
  return (
    <>
      <Link href="/admin/questions" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Questions
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Import questions from CSV</h1>
      <div className="mt-2 max-w-prose space-y-2 text-sm text-muted">
        <p>
          One row per question. Rows are matched by <code>key</code>: new keys are created, and existing keys are updated in place, so
          you can export, edit in a spreadsheet, and re-import. Every row is checked first (references, LaTeX, required fields), and
          nothing is saved unless all rows pass.
        </p>
        <p>
          Columns: <code>{CSV_COLUMNS.join(", ")}</code>. <code>part</code> is CP, CARS, BB, or PS; <code>answer</code> is A–D;{" "}
          <code>topic</code> is an AAMC code like 5A; <code>chapter</code> is a chapter slug. <code>in_bank</code>,{" "}
          <code>is_free</code>, and <code>published</code> take true/false.
        </p>
        <p>
          <a href="/api/admin/questions.csv?template=1" className="font-semibold text-[var(--c-accent)] underline">
            Download the template
          </a>{" "}
          or{" "}
          <a href="/api/admin/questions.csv" className="font-semibold text-[var(--c-accent)] underline">
            export all questions
          </a>
          .
        </p>
      </div>
      <div className="mt-6 max-w-[760px]">
        <Suspense fallback={null}>
          <Gate />
        </Suspense>
      </div>
    </>
  );
}

async function Gate() {
  await requireRole("ADMIN");
  return <ImportForm />;
}
