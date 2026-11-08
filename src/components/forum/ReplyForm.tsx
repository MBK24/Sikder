"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { ForumFormState } from "@/server/actions/forum";

export function ReplyForm({
  action,
  uploadsEnabled,
  userId,
  defaultValue,
  label = "Your answer",
  submitLabel = "Post answer",
  onDone,
}: {
  action: (prev: ForumFormState, form: FormData) => Promise<ForumFormState>;
  uploadsEnabled: boolean;
  userId: string;
  defaultValue?: string;
  label?: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ForumFormState, FormData>(action, {});
  // Remount the editor after a successful post to clear it.
  const [key, setKey] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the editor once per successful submit
      setKey((k) => k + 1);
      done.current?.();
    }
  }, [state]);
  return (
    <form action={formAction} className="space-y-3">
      <MarkdownEditor key={key} name="body" label={label} rows={8} defaultValue={defaultValue} uploadsEnabled={uploadsEnabled} userId={userId} />
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--c-trap)]">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Posting…" : submitLabel}
      </button>
    </form>
  );
}
