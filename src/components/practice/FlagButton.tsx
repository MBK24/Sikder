"use client";

import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { toggleFlag } from "@/server/actions/practice";

export function FlagButton({ questionId, initial }: { questionId: string; initial: boolean }) {
  const [flagged, setFlagged] = useOptimistic(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={flagged}
      className={clsx("btn btn-ghost !px-2.5 !py-1 text-xs", flagged && "!border-[var(--c-hy)] !text-[var(--c-hy)]")}
      onClick={() =>
        start(async () => {
          setFlagged(!flagged);
          await toggleFlag(questionId, !flagged);
        })
      }
    >
      {flagged ? "⚑ Flagged" : "⚐ Flag for later"}
    </button>
  );
}
