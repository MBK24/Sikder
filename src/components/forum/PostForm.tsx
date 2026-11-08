"use client";

import { useActionState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { ForumFormState } from "@/server/actions/forum";

export interface PostFormProps {
  action: (prev: ForumFormState, form: FormData) => Promise<ForumFormState>;
  categories: { slug: string; name: string }[];
  initial?: { title?: string; body?: string; category?: string; tags?: string };
  chapter?: { slug: string; title: string; anchor?: string };
  canMarkPriority: boolean;
  uploadsEnabled: boolean;
  userId: string;
  submitLabel: string;
  textLocked?: boolean;
}

export function PostForm(p: PostFormProps) {
  const [state, action, pending] = useActionState<ForumFormState, FormData>(p.action, {});
  return (
    <form action={action} className="space-y-5">
      {p.chapter ? (
        <p className="rounded-md bg-[var(--c-bg-subtle)] px-3 py-2 text-sm">
          About the chapter <strong>{p.chapter.title}</strong>
          {p.chapter.anchor ? <span className="text-muted"> (section #{p.chapter.anchor})</span> : null}
          <input type="hidden" name="chapter" value={p.chapter.slug} />
          {p.chapter.anchor ? <input type="hidden" name="anchor" value={p.chapter.anchor} /> : null}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Title</span>
        <input
          name="title"
          className="input"
          required
          minLength={15}
          maxLength={150}
          defaultValue={p.initial?.title}
          readOnly={p.textLocked}
          placeholder="e.g. Why does a competitive inhibitor leave Vmax unchanged?"
        />
        <span className="mt-1 block text-xs text-muted">Write it as a question someone could answer.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Category</span>
          <select name="category" className="input" defaultValue={p.initial?.category} required>
            {p.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Tags (up to 5)</span>
          <input name="tags" className="input" defaultValue={p.initial?.tags} placeholder="enzymes, kinetics" />
        </label>
      </div>
      {p.textLocked ? (
        <input type="hidden" name="body" value={p.initial?.body} />
      ) : (
        <MarkdownEditor
          name="body"
          label="Details"
          rows={12}
          defaultValue={p.initial?.body}
          uploadsEnabled={p.uploadsEnabled}
          userId={p.userId}
          placeholder="What are you stuck on? Include what you've tried and where your reasoning breaks down. Tutors can help faster when they see your thinking."
        />
      )}
      {p.canMarkPriority ? (
        <label className="flex items-start gap-2 rounded-md border border-[var(--c-conn)] bg-[var(--c-conn-bg)] p-3 text-sm">
          <input type="checkbox" name="priority" className="mt-1" defaultChecked />
          <span>
            <strong>Priority question</strong>: shown to Verified Tutors first. (Included with Premium + Tutoring.)
          </span>
        </label>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-md border border-[var(--c-trap)] bg-[var(--c-trap-bg)] px-3 py-2 text-sm text-[var(--c-trap)]">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Posting…" : p.submitLabel}
      </button>
    </form>
  );
}
