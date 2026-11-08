"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { saveAnswers, submitSet, abandonSet } from "@/server/actions/practice";

type ChoiceId = "A" | "B" | "C" | "D";

export interface RunnerItem {
  questionId: string;
  order: number;
  selected: ChoiceId | null;
  marked: boolean;
  passageId: string | null;
  stemHtml: string;
  choices: { id: ChoiceId; html: string }[];
}

export interface RunnerPassage {
  id: string;
  title: string | null;
  html: string;
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function TestRunner({
  setId,
  title,
  items: initial,
  passages,
  deadlineAt,
  timeLimitSec,
}: {
  setId: string;
  title: string;
  items: RunnerItem[];
  passages: Record<string, RunnerPassage>;
  deadlineAt: string | null;
  timeLimitSec: number | null;
}) {
  const [items, setItems] = useState(initial);
  const firstUnanswered = Math.max(0, initial.findIndex((i) => !i.selected));
  const [index, setIndex] = useState(firstUnanswered);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const shownAt = useRef<number>(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const autoSubmitted = useRef(false);
  const item = items[index];
  const passage = item.passageId ? passages[item.passageId] : null;

  // Changes are merged per question and flushed in one batched call (at most one in flight),
  // so fast answering never builds a long queue that a reload could cut off.
  type Pending = { selected?: ChoiceId | null; marked?: boolean; addTimeMs: number };
  const pending = useRef(new Map<string, Pending>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unsaved, setUnsaved] = useState(false);

  const flush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    queue.current = queue.current.then(async () => {
      if (!pending.current.size) return;
      const items = [...pending.current.entries()].map(([questionId, p]) => ({ questionId, ...p }));
      pending.current.clear();
      try {
        const r = await saveAnswers({ setId, items });
        if (!r.ok) setSaveError(r.reason === "time-up" ? "Time is up. Submitting…" : "Your answers couldn't be saved. Check your connection.");
        else setSaveError(null);
      } catch {
        // Put the changes back so the next flush retries them.
        for (const it of items) {
          const cur = pending.current.get(it.questionId);
          pending.current.set(it.questionId, {
            selected: cur?.selected !== undefined ? cur.selected : it.selected,
            marked: cur?.marked !== undefined ? cur.marked : it.marked,
            addTimeMs: (cur?.addTimeMs ?? 0) + it.addTimeMs,
          });
        }
        setSaveError("Your answers couldn't be saved. Check your connection.");
      }
      setUnsaved(pending.current.size > 0);
    });
    return queue.current;
  }, [setId]);

  const enqueueSave = useCallback(
    (data: { questionId: string; selected?: ChoiceId | null; marked?: boolean; addTimeMs?: number }) => {
      const cur = pending.current.get(data.questionId) ?? { addTimeMs: 0 };
      pending.current.set(data.questionId, {
        ...cur,
        ...(data.selected !== undefined ? { selected: data.selected } : {}),
        ...(data.marked !== undefined ? { marked: data.marked } : {}),
        addTimeMs: cur.addTimeMs + (data.addTimeMs ?? 0),
      });
      setUnsaved(true);
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 300);
    },
    [flush],
  );

  /** Time spent on the current question since it was shown (then resets the clock). */
  const takeElapsed = useCallback(() => {
    const now = performance.now();
    const ms = shownAt.current ? Math.round(now - shownAt.current) : 0;
    shownAt.current = now;
    return Math.min(ms, 30 * 60_000);
  }, []);

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length || next === index) return;
      enqueueSave({ questionId: items[index].questionId, addTimeMs: takeElapsed() });
      setIndex(next);
      document.getElementById("runner-question")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    },
    [enqueueSave, index, items, takeElapsed],
  );

  const select = useCallback(
    (choice: ChoiceId) => {
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, selected: choice } : it)));
      enqueueSave({ questionId: items[index].questionId, selected: choice, addTimeMs: takeElapsed() });
    },
    [enqueueSave, index, items, takeElapsed],
  );

  const toggleMark = useCallback(() => {
    const marked = !items[index].marked;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, marked } : it)));
    enqueueSave({ questionId: items[index].questionId, marked });
  }, [enqueueSave, index, items]);

  const submit = useCallback(() => {
    startSubmit(async () => {
      enqueueSave({ questionId: items[index].questionId, addTimeMs: takeElapsed() });
      await flush();
      await submitSet(setId);
    });
  }, [enqueueSave, flush, index, items, setId, takeElapsed]);

  // Countdown against the server deadline.
  useEffect(() => {
    if (!deadlineAt) return;
    const end = new Date(deadlineAt).getTime();
    const tick = () => {
      const left = (end - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submit();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlineAt, submit]);

  // Keyboard: A–D or 1–4 to answer, ←/→ (or P/N) to move, M to mark.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      const map: Record<string, ChoiceId> = { a: "A", b: "B", c: "C", d: "D", "1": "A", "2": "B", "3": "C", "4": "D" };
      if (map[k]) select(map[k]);
      else if (k === "arrowright" || k === "n") goTo(index + 1);
      else if (k === "arrowleft" || k === "p") goTo(index - 1);
      else if (k === "m") toggleMark();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, goTo, index, select, toggleMark]);

  // Only warn before leaving while changes are still being saved; flush when the tab is hidden.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (unsaved && !submitting) e.preventDefault();
    };
    const onHide = () => document.visibilityState === "hidden" && void flush();
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush, submitting, unsaved]);

  const answered = useMemo(() => items.filter((i) => i.selected).length, [items]);
  const markedCount = useMemo(() => items.filter((i) => i.marked).length, [items]);
  const lowTime = remaining !== null && timeLimitSec ? remaining < Math.min(300, timeLimitSec * 0.1) : false;

  return (
    <div className="font-sans">
      {/* Exam toolbar */}
      <div className="sticky top-14 z-30 border-b border-[var(--c-border)] bg-[var(--c-bg)]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
          <p className="text-sm text-muted" aria-live="polite">
            Question {index + 1} of {items.length}
          </p>
          {remaining !== null ? (
            <p
              className={clsx("rounded px-2 py-0.5 text-sm font-semibold tabular-nums", lowTime ? "bg-[var(--c-trap-bg)] text-[var(--c-trap)]" : "bg-[var(--c-bg-subtle)]")}
              role="timer"
              aria-label={`Time remaining ${fmt(remaining)}`}
            >
              {fmt(remaining)}
            </p>
          ) : (
            <p className="text-sm text-muted">Untimed</p>
          )}
          <button type="button" className="btn btn-primary !py-1.5" onClick={() => setConfirming(true)} disabled={submitting}>
            Review & submit
          </button>
        </div>
        {saveError ? (
          <p role="alert" className="bg-[var(--c-trap-bg)] px-4 py-1.5 text-center text-sm text-[var(--c-trap)]">
            {saveError}
          </p>
        ) : null}
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-6">
        <div className={clsx("grid gap-8", passage && "lg:grid-cols-2")}>
          {passage ? (
            <section aria-label="Passage" className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Passage{passage.title ? `: ${passage.title}` : ""}</p>
              <div className="prose book-prose !text-[1.02rem]" dangerouslySetInnerHTML={{ __html: passage.html }} />
            </section>
          ) : null}

          <section id="runner-question" tabIndex={-1} aria-label={`Question ${index + 1}`} className={clsx("outline-none", !passage && "mx-auto w-full max-w-[760px]")}>
            <div className="prose book-prose !text-[1.05rem]" dangerouslySetInnerHTML={{ __html: item.stemHtml }} />
            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">Answer choices</legend>
              {item.choices.map((c) => (
                <label key={c.id} className={clsx("choice", item.selected === c.id && "choice-selected")}>
                  <input
                    type="radio"
                    name={`q-${item.questionId}`}
                    value={c.id}
                    checked={item.selected === c.id}
                    aria-label={`Choice ${c.id}`}
                    aria-describedby={`q-${item.questionId}-${c.id}`}
                    onChange={() => select(c.id)}
                    className="sr-only"
                  />
                  <span className="choice-letter" aria-hidden>
                    {c.id}
                  </span>
                  <span id={`q-${item.questionId}-${c.id}`} className="choice-text font-serif" dangerouslySetInnerHTML={{ __html: c.html }} />
                </label>
              ))}
            </fieldset>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
                ← Previous
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => goTo(index + 1)} disabled={index === items.length - 1}>
                Next →
              </button>
              <button type="button" className={clsx("btn btn-ghost", item.marked && "!border-[var(--c-hy)] !text-[var(--c-hy)]")} aria-pressed={item.marked} onClick={toggleMark}>
                {item.marked ? "★ Marked" : "☆ Mark for review"}
              </button>
              <p className="ml-auto hidden text-xs text-muted sm:block">Keys: A–D answer · ←/→ move · M mark</p>
            </div>
          </section>
        </div>

        {/* Question palette */}
        <nav aria-label="Questions" className="mt-10 border-t border-[var(--c-border)] pt-5">
          <p className="mb-2 text-sm text-muted">
            {answered} of {items.length} answered{markedCount ? ` · ${markedCount} marked` : ""}
          </p>
          <ol className="flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <li key={it.questionId}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}${it.selected ? ", answered" : ", not answered"}${it.marked ? ", marked" : ""}`}
                  className={clsx(
                    "palette-btn",
                    it.selected && "is-answered",
                    it.marked && "is-marked",
                    i === index && "is-current",
                  )}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="w-full max-w-md rounded-lg bg-[var(--c-bg)] p-6 shadow-xl">
            <h2 id="submit-title" className="text-lg font-semibold">
              Submit this set?
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                {answered} of {items.length} answered
              </li>
              {items.length - answered ? (
                <li className="text-[var(--c-trap)]">{items.length - answered} unanswered (they count as incorrect; there&apos;s no guessing penalty)</li>
              ) : null}
              {markedCount ? <li className="text-[var(--c-hy)]">{markedCount} marked for review</li> : null}
            </ul>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost mr-auto text-sm"
                onClick={() => {
                  if (confirm("Discard this set? Your answers won't be scored.")) void abandonSet(setId);
                }}
              >
                Discard set
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} autoFocus>
                Keep working
              </button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Scoring…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
