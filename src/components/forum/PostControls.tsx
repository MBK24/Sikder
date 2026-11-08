"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptReply, editReply, reportContent } from "@/server/actions/forum";
import { moderatePost, moderateReply } from "@/server/actions/moderation";
import { ReplyForm } from "./ReplyForm";

export function AcceptButton({ postId, replyId, accepted }: { postId: string; replyId: string; accepted: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={accepted}
      className="btn btn-ghost !px-2.5 !py-1 text-xs"
      onClick={() =>
        start(async () => {
          await acceptReply(postId, accepted ? null : replyId);
          router.refresh();
        })
      }
    >
      {accepted ? "Unaccept" : "✓ Accept this answer"}
    </button>
  );
}

const REASONS = [
  ["spam", "Spam or advertising"],
  ["harassment", "Rude or harassing"],
  ["incorrect", "Factually wrong / misleading"],
  ["cheating", "Shares real exam content"],
  ["other", "Something else"],
] as const;

export function ReportButton({ target }: { target: { postId?: string; replyId?: string; targetUserId?: string } }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span className="text-xs text-muted">{msg}</span>;
  return (
    <span className="relative">
      <button type="button" className="text-xs text-muted hover:text-[var(--c-trap)]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Report
      </button>
      {open ? (
        <form
          className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] p-3 text-sm shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await reportContent({ ...target, reason: f.get("reason") as "spam", details: String(f.get("details") || "") || undefined });
              setMsg(r.ok ? "Thanks, a moderator will take a look." : r.error);
              setOpen(false);
            });
          }}
        >
          <fieldset className="space-y-1">
            <legend className="mb-1 font-semibold">What&apos;s wrong?</legend>
            {REASONS.map(([v, l], i) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="reason" value={v} defaultChecked={i === 0} /> {l}
              </label>
            ))}
          </fieldset>
          <textarea name="details" rows={2} className="input !text-sm" placeholder="Optional details" maxLength={1000} />
          <button className="btn btn-primary !py-1 text-xs" disabled={pending}>
            Send report
          </button>
        </form>
      ) : null}
    </span>
  );
}

export function ModPostTools({ postId, status }: { postId: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (a: "hide" | "unhide" | "lock" | "unlock") =>
    start(async () => {
      const why = a === "hide" || a === "lock" ? (prompt("Reason (shown to the author):") ?? undefined) : undefined;
      await moderatePost(postId, a, why);
      router.refresh();
    });
  return (
    <span className="flex gap-2 text-xs">
      <span className="font-semibold text-muted">Mod:</span>
      {status === "HIDDEN" ? (
        <button type="button" disabled={pending} onClick={() => act("unhide")} className="underline">
          Unhide
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => act("hide")} className="underline">
          Hide
        </button>
      )}
      {status === "LOCKED" ? (
        <button type="button" disabled={pending} onClick={() => act("unlock")} className="underline">
          Unlock
        </button>
      ) : status === "OPEN" ? (
        <button type="button" disabled={pending} onClick={() => act("lock")} className="underline">
          Lock
        </button>
      ) : null}
    </span>
  );
}

export function ModReplyTools({ replyId, hidden }: { replyId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs underline"
      onClick={() =>
        start(async () => {
          const why = hidden ? undefined : (prompt("Reason (shown to the author):") ?? undefined);
          await moderateReply(replyId, hidden ? "unhide" : "hide", why);
          router.refresh();
        })
      }
    >
      {hidden ? "Unhide answer" : "Hide answer"}
    </button>
  );
}

export function EditReply({ replyId, body, uploadsEnabled, userId }: { replyId: string; body: string; uploadsEnabled: boolean; userId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!open)
    return (
      <button type="button" className="text-xs text-muted hover:text-[var(--c-accent)]" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  return (
    <div className="mt-3 w-full">
      <ReplyForm
        action={editReply.bind(null, replyId)}
        defaultValue={body}
        uploadsEnabled={uploadsEnabled}
        userId={userId}
        label="Edit your answer"
        submitLabel="Save changes"
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
