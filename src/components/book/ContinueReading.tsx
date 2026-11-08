"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

interface Resume {
  href: string;
  title: string;
  pct: number;
}

/** "Pick up where you left off" card for signed-in readers. */
export function ContinueReading() {
  const { data: session } = useSession();
  const [resume, setResume] = useState<Resume | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/me/resume")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resume | null) => !cancelled && setResume(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId || !resume) return null;
  return (
    <Link
      href={resume.href}
      className="mt-8 flex items-center gap-4 rounded-lg border border-[var(--c-accent)] bg-[var(--c-accent-soft)] p-4 font-sans"
    >
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--c-accent)]">Continue reading</p>
        <p className="font-semibold">{resume.title}</p>
      </div>
      <span className="text-sm text-muted">{Math.round(resume.pct * 100)}%</span>
    </Link>
  );
}
