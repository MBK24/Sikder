"use client";

import { useActionState } from "react";
import { applyForVerification, type VerifyFormState } from "@/server/actions/verification";

export function VerifyForm() {
  const [state, action, pending] = useActionState<VerifyFormState, FormData>(applyForVerification, {});
  if (state.ok) return <p className="rounded-lg border border-[var(--c-ok)] bg-[var(--c-ok-bg)] p-4">Thanks! Your application is in the review queue. We&apos;ll email you when it&apos;s decided.</p>;
  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">I&apos;m applying as</legend>
        <label className="mr-4 inline-flex items-center gap-2 text-sm">
          <input type="radio" name="kind" value="TUTOR" defaultChecked /> Verified Tutor
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="kind" value="EXPERT" /> Expert (MD, PhD, faculty)
        </label>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Headline credential</span>
        <input name="credential" className="input" required maxLength={300} placeholder="e.g. Scored 519 (2025) · 3 years tutoring at a test-prep company" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">MCAT score (if applicable)</span>
        <input name="score" type="number" min={472} max={528} className="input !w-40" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Background</span>
        <textarea name="experience" rows={5} className="input" required minLength={30} maxLength={3000} placeholder="Tutoring experience, subjects, degrees, where you teach…" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Link for verification (optional)</span>
        <input name="link" type="url" className="input" placeholder="LinkedIn, faculty page, or tutoring profile" />
        <span className="mt-1 block text-xs text-muted">We may email you to ask for a score report or other proof. Please don&apos;t paste documents here.</span>
      </label>
      {state.error ? <p role="alert" className="text-sm text-[var(--c-trap)]">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
