"use client";

import { useActionState } from "react";
import { importQuestionsCsv, type ImportState } from "@/server/actions/admin-questions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importQuestionsCsv, {});
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4 rounded-lg border border-[var(--c-border)] p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">CSV file</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="dryRun" defaultChecked /> Validate only (don&apos;t save)
        </label>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Checking…" : "Upload"}
        </button>
      </form>
      {state.fatal ? (
        <p role="alert" className="text-sm text-[var(--c-trap)]">
          {state.fatal}
        </p>
      ) : null}
      {state.done && state.errors?.length ? (
        <div role="alert" className="rounded-lg border border-[var(--c-trap)] p-4">
          <p className="font-semibold text-[var(--c-trap)]">
            {state.errors.length} row{state.errors.length === 1 ? "" : "s"} need fixing. Nothing was saved.
          </p>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm">
            {state.errors.map((e) => (
              <li key={`${e.row}-${e.key}`}>
                <strong>Row {e.row}</strong> {e.key ? <code>{e.key}</code> : null}: {e.problems.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.done && !state.errors?.length ? (
        <p role="status" className="rounded-lg border border-[var(--c-ok)] bg-[var(--c-ok-bg)] p-4 text-sm">
          {state.dryRun ? "All rows are valid. " : "Imported. "}
          {state.created} new, {state.updated} updated{state.dryRun ? ". Uncheck “Validate only” and upload again to save." : "."}
        </p>
      ) : null}
    </div>
  );
}
