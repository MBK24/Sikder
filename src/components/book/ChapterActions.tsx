"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setChapterComplete } from "@/server/actions/progress";
import { useBookProgress } from "./BookShell";
import { useSession } from "@/lib/auth-client";

export function ChapterActions({ part, slug, title }: { part: string; slug: string; title: string }) {
  const { completed, setCompleted } = useBookProgress();
  const { data: session } = useSession();
  const key = `${part}/${slug}`;
  const isDone = completed.has(key);
  const [optimisticDone, setOptimisticDone] = useOptimistic(isDone);
  const [pending, startTransition] = useTransition();

  return (
    <div className="no-print mt-4 flex flex-col gap-4 rounded-lg border border-[var(--c-border)] bg-[var(--c-bg-subtle)] p-5 font-sans sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-semibold">{optimisticDone ? "Chapter complete" : "Finished this chapter?"}</p>
        <p className="text-sm text-muted">
          {session
            ? optimisticDone
              ? "Nice work. It's checked off in the sidebar."
              : "Mark it complete to track your progress through the book."
            : "Sign in to save your progress across devices."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/forum/chapter/${slug}`} className="btn btn-ghost" title={`Questions and answers about ${title}`}>
          Discuss this chapter
        </Link>
        {session ? (
          <button
            type="button"
            className={optimisticDone ? "btn btn-ghost" : "btn btn-primary"}
            aria-pressed={optimisticDone}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const next = !optimisticDone;
                setOptimisticDone(next);
                const r = await setChapterComplete({ part, slug, completed: next });
                if (r.ok) setCompleted(key, next);
              })
            }
          >
            {optimisticDone ? "✓ Completed" : "Mark as complete"}
          </button>
        ) : (
          <Link href={`/sign-in?next=/${part}/${slug}`} className="btn btn-primary">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
