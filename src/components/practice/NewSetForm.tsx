"use client";

import { useActionState, useState } from "react";
import { startCustomSet, type StartState } from "@/server/actions/practice";

interface TopicOpt {
  code: string;
  name: string;
  part: string;
}

const PARTS = [
  { id: "CP", label: "Chem/Phys" },
  { id: "CARS", label: "CARS" },
  { id: "BB", label: "Bio/Biochem" },
  { id: "PS", label: "Psych/Soc" },
];

export function NewSetForm({
  topics,
  canTime,
  initial,
}: {
  topics: TopicOpt[];
  canTime: boolean;
  initial: { parts: string[]; status: string };
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startCustomSet, {});
  const [parts, setParts] = useState<string[]>(initial.parts);
  const [timed, setTimed] = useState(false);
  const shownTopics = topics.filter((t) => !parts.length || parts.includes(t.part));

  return (
    <form action={action} className="mt-8 space-y-8">
      <fieldset>
        <legend className="mb-2 font-semibold">Sections</legend>
        <div className="flex flex-wrap gap-2">
          {PARTS.map((p) => (
            <label key={p.id} className="chip">
              <input
                type="checkbox"
                name="parts"
                value={p.id}
                checked={parts.includes(p.id)}
                onChange={(e) => setParts((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              />
              {p.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Leave all unchecked to mix every section.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">Topics (optional)</legend>
        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-[var(--c-border)] p-3 sm:grid-cols-2">
          {shownTopics.map((t) => (
            <label key={t.code} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="topics" value={t.code} className="mt-1" />
              <span>
                <span className="mr-1 text-muted">{t.code.replace("CARS-", "")}</span>
                {t.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 font-semibold">Difficulty</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ["INTRO", "Intro"],
              ["CORE", "Core"],
              ["ADVANCED", "Advanced"],
            ].map(([v, l]) => (
              <label key={v} className="chip">
                <input type="checkbox" name="difficulties" value={v} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-2 block font-semibold">Questions</span>
          <select name="status" defaultValue={initial.status} className="input">
            <option value="all">All questions</option>
            <option value="unseen">Unseen only</option>
            <option value="incorrect">Ones I got wrong</option>
            <option value="correct">Ones I got right</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block font-semibold">Number of questions</span>
          <input name="count" type="number" min={1} max={100} defaultValue={10} className="input" required />
        </label>
        <fieldset>
          <legend className="mb-2 font-semibold">Timing</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="timed" checked={timed} disabled={!canTime} onChange={(e) => setTimed(e.target.checked)} />
            Timed {canTime ? "" : "(Premium)"}
          </label>
          {timed ? (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input name="secondsPerQuestion" type="number" min={30} max={300} defaultValue={96} className="input !w-24" />
              seconds per question <span className="text-muted">(test day ≈ 96)</span>
            </label>
          ) : null}
        </fieldset>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md border border-[var(--c-trap)] bg-[var(--c-trap-bg)] px-3 py-2 text-sm text-[var(--c-trap)]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Building your set…" : "Start practice set"}
      </button>
    </form>
  );
}
