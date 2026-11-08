"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { answerInlineQuestion, type AnswerResult } from "@/server/actions/questions";
import { useSession } from "@/lib/auth-client";

type ChoiceId = "A" | "B" | "C" | "D";

export function QuestionCard({
  questionKey,
  stemHtml,
  passageHtml,
  passageTitle,
  choices,
}: {
  questionKey: string;
  stemHtml: string;
  passageHtml?: string;
  passageTitle?: string;
  choices: { id: ChoiceId; html: string }[];
}) {
  const [selected, setSelected] = useState<ChoiceId | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const startedAt = useRef<number | null>(null);
  const { data: session } = useSession();
  const name = `q-${questionKey}`;

  function submit() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await answerInlineQuestion({
          key: questionKey,
          selected,
          timeSpentMs: startedAt.current ? Math.round(performance.now() - startedAt.current) : 0,
        });
        setResult(r);
      } catch {
        setError("Couldn't check your answer. Please try again.");
      }
    });
  }

  function reset() {
    setResult(null);
    setSelected(null);
    startedAt.current = performance.now();
  }

  return (
    <section className="question-card not-prose" aria-labelledby={`${name}-label`}>
      <header className="question-header">
        <span id={`${name}-label`}>Practice question</span>
      </header>
      {passageHtml ? (
        <details className="question-passage">
          <summary>{passageTitle ? `Passage: ${passageTitle}` : "Read the passage"}</summary>
          <div className="prose" dangerouslySetInnerHTML={{ __html: passageHtml }} />
        </details>
      ) : null}
      <div className="prose question-stem" dangerouslySetInnerHTML={{ __html: stemHtml }} />
      <fieldset disabled={!!result || pending} className="mt-3 space-y-2">
        <legend className="sr-only">Answer choices</legend>
        {choices.map((c) => {
          const isAnswer = result?.answer === c.id;
          const isWrongPick = result && selected === c.id && !result.correct;
          return (
            <label
              key={c.id}
              className={clsx(
                "choice",
                selected === c.id && !result && "choice-selected",
                isAnswer && "choice-correct",
                isWrongPick && "choice-incorrect",
              )}
              onPointerDown={() => (startedAt.current ??= performance.now())}
            >
              <input
                type="radio"
                name={name}
                value={c.id}
                checked={selected === c.id}
                onChange={() => {
                  startedAt.current ??= performance.now();
                  setSelected(c.id);
                }}
                className="sr-only"
              />
              <span className="choice-letter" aria-hidden>
                {c.id}
              </span>
              <span className="choice-text" dangerouslySetInnerHTML={{ __html: c.html }} />
              {isAnswer ? <span className="sr-only">(correct answer)</span> : null}
              {isWrongPick ? <span className="sr-only">(your answer, incorrect)</span> : null}
            </label>
          );
        })}
      </fieldset>

      {!result ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!selected || pending}>
            {pending ? "Checking…" : "Check answer"}
          </button>
          {error ? <p className="text-sm text-[var(--c-trap)]">{error}</p> : null}
        </div>
      ) : (
        <div className="question-result" role="status" aria-live="polite">
          <p className={clsx("result-verdict", result.correct ? "is-correct" : "is-incorrect")}>
            {result.correct ? "Correct." : `Not quite. The answer is ${result.answer}.`}
          </p>
          <div className="prose" dangerouslySetInnerHTML={{ __html: result.explanationHtml }} />
          {Object.keys(result.whyWrongHtml).length ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-sans text-sm font-semibold">Why the other choices are wrong</summary>
              <dl className="mt-2 space-y-2">
                {(Object.entries(result.whyWrongHtml) as [ChoiceId, string][]).map(([k, html]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="choice-letter shrink-0">{k}</dt>
                    <dd className="prose text-[0.95em]" dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 font-sans text-sm">
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Try again
            </button>
            {!session ? (
              <span className="text-muted">
                <Link href="/sign-in" className="underline">
                  Sign in
                </Link>{" "}
                to save your answers and track progress.
              </span>
            ) : result.saved ? (
              <span className="text-muted">Saved to your history.</span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
