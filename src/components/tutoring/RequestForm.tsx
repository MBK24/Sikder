"use client";

import { useActionState } from "react";
import { requestTutoring, type TutoringFormState } from "@/server/actions/tutoring";

export function RequestForm({ tutorId, tutorName, remaining, limit }: { tutorId: string; tutorName: string; remaining: number; limit: number }) {
  const [state, action, pending] = useActionState<TutoringFormState, FormData>(requestTutoring, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tutorId" value={tutorId} />
      <p className="text-sm text-muted">
        You have <strong className="text-[var(--c-fg)]">{remaining}</strong> of {limit} session requests left this month. {tutorName} will reply here and
        by email.
      </p>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Section</span>
          <select name="part" className="input">
            <option value="">General</option>
            <option value="CP">Chem/Phys</option>
            <option value="CARS">CARS</option>
            <option value="BB">Bio/Biochem</option>
            <option value="PS">Psych/Soc</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Topic</span>
          <input name="topic" className="input" required minLength={3} maxLength={120} placeholder="e.g. Titration curves and buffer questions" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">What would you like help with?</span>
        <textarea name="message" rows={4} className="input" required minLength={20} maxLength={3000} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">When are you free?</span>
        <input name="times" className="input" required maxLength={500} placeholder="e.g. Weeknights after 7pm ET, Sat mornings" />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--c-trap)]">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={pending || remaining === 0}>
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
