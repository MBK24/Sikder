"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport } from "@/server/actions/moderation";

export function ResolveButtons({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (s: "RESOLVED" | "DISMISSED") =>
    start(async () => {
      const note = prompt(s === "RESOLVED" ? "What did you do? (optional)" : "Why dismiss? (optional)") ?? undefined;
      await resolveReport(reportId, s, note || undefined);
      router.refresh();
    });
  return (
    <span className="flex gap-2">
      <button type="button" className="btn btn-primary !px-2.5 !py-1 text-xs" disabled={pending} onClick={() => go("RESOLVED")}>
        Resolve
      </button>
      <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-xs" disabled={pending} onClick={() => go("DISMISSED")}>
        Dismiss
      </button>
    </span>
  );
}
