"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { toggleVote } from "@/server/actions/forum";

export function VoteButton({
  target,
  initialScore,
  initialVoted,
  disabledReason,
}: {
  target: { postId?: string; replyId?: string };
  initialScore: number;
  initialVoted: boolean;
  /** When set, the button explains why it can't be used instead of voting. */
  disabledReason?: string;
}) {
  const [state, setState] = useState({ score: initialScore, voted: initialVoted });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="relative flex flex-col items-center gap-0.5">
      <button
        type="button"
        aria-pressed={state.voted}
        aria-label={state.voted ? "Remove upvote" : "Upvote"}
        title={disabledReason ?? (state.voted ? "Remove upvote" : "This is helpful")}
        disabled={pending}
        onClick={() => {
          if (disabledReason) return setMsg(disabledReason);
          start(async () => {
            const prev = state;
            setState({ score: prev.score + (prev.voted ? -1 : 1), voted: !prev.voted });
            const r = await toggleVote(target);
            if (r.ok) setState({ score: r.score, voted: r.voted });
            else {
              setState(prev);
              setMsg(r.error);
            }
          });
        }}
        className={clsx("vote-btn", state.voted && "is-voted")}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M12 5l7 9H5z" fill={state.voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="text-sm font-semibold tabular-nums" aria-label={`${state.score} votes`}>
        {state.score}
      </span>
      {msg ? (
        <span role="status" className="absolute z-10 mt-16 w-48 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] p-2 text-xs shadow" onClick={() => setMsg(null)}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}
