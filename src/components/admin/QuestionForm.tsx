"use client";

import { useActionState } from "react";
import { saveQuestion, type QuestionFormState } from "@/server/actions/admin-questions";

export interface QuestionFields {
  key: string;
  part: string;
  topic: string;
  difficulty: string;
  chapter: string;
  passage: string;
  stem: string;
  a: string;
  b: string;
  c: string;
  d: string;
  answer: string;
  explanation: string;
  why_a: string;
  why_b: string;
  why_c: string;
  why_d: string;
  in_bank: boolean;
  is_free: boolean;
  published: boolean;
}

function Area({ name, label, value, rows = 3, required }: { name: string; label: string; value: string; rows?: number; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea name={name} rows={rows} defaultValue={value} required={required} className="input font-mono !text-[0.88rem]" />
    </label>
  );
}

export function QuestionForm({
  questionId,
  initial,
  topics,
  chapters,
}: {
  questionId: string | null;
  initial: QuestionFields;
  topics: { code: string; name: string }[];
  chapters: { slug: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(saveQuestion.bind(null, questionId), {});
  return (
    <form action={action} className="space-y-5">
      {state.errors?.length ? (
        <ul role="alert" className="list-disc rounded-md border border-[var(--c-trap)] bg-[var(--c-trap-bg)] py-2 pl-8 pr-3 text-sm text-[var(--c-trap)]">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-semibold">Key</span>
          <input name="key" defaultValue={initial.key} required className="input font-mono" placeholder="cp-acids-21" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Section</span>
          <select name="part" defaultValue={initial.part} className="input">
            <option value="CP">Chem/Phys</option>
            <option value="CARS">CARS</option>
            <option value="BB">Bio/Biochem</option>
            <option value="PS">Psych/Soc</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Difficulty</span>
          <select name="difficulty" defaultValue={initial.difficulty} className="input">
            <option value="INTRO">Intro</option>
            <option value="CORE">Core</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">AAMC topic</span>
          <select name="topic" defaultValue={initial.topic} className="input">
            <option value="">None</option>
            {topics.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} · {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Chapter</span>
          <select name="chapter" defaultValue={initial.chapter} className="input">
            <option value="">None</option>
            {chapters.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Passage key</span>
          <input name="passage" defaultValue={initial.passage} className="input font-mono" placeholder="optional" />
        </label>
      </div>
      <Area name="stem" label="Stem (Markdown + LaTeX)" value={initial.stem} rows={5} required />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["a", "b", "c", "d"] as const).map((k) => (
          <div key={k} className="space-y-2 rounded-md border border-[var(--c-border)] p-3">
            <Area name={k} label={`Choice ${k.toUpperCase()}`} value={initial[k]} rows={2} required />
            <Area name={`why_${k}`} label="Why it's wrong (leave blank for the answer)" value={initial[`why_${k}`]} rows={2} />
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Correct answer</legend>
        <div className="flex gap-4">
          {["A", "B", "C", "D"].map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="radio" name="answer" value={k} defaultChecked={initial.answer === k} required /> {k}
            </label>
          ))}
        </div>
      </fieldset>
      <Area name="explanation" label="Explanation" value={initial.explanation} rows={5} required />
      <fieldset className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={initial.published} /> Published
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="in_bank" defaultChecked={initial.in_bank} /> In question bank
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_free" defaultChecked={initial.is_free} /> Free-tier question
        </label>
      </fieldset>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save question"}
      </button>
    </form>
  );
}
