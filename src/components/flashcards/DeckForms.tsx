"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCard, createDeck, type FormState } from "@/server/actions/flashcards";

export function NewDeckForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createDeck, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Title</span>
        <input name="title" className="input" required maxLength={120} placeholder="e.g. Hormones I keep forgetting" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Description (optional)</span>
        <input name="description" className="input" maxLength={500} />
      </label>
      {state.error ? <p role="alert" className="text-sm text-[var(--c-trap)]">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create deck"}
      </button>
    </form>
  );
}

export function AddCardForm({ deckId }: { deckId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCard.bind(null, deckId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      ref.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    }
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3 rounded-lg border border-[var(--c-border)] p-4">
      <p className="text-sm text-muted">
        Markdown and math work: <code>**bold**</code>, <code>$\ce&#123;H2O&#125;$</code>, <code>$E = mc^2$</code>.
      </p>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Front</span>
        <textarea name="front" rows={2} className="input" required maxLength={2000} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Back</span>
        <textarea name="back" rows={3} className="input" required maxLength={4000} />
      </label>
      {state.error ? <p role="alert" className="text-sm text-[var(--c-trap)]">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add card"}
      </button>
    </form>
  );
}
