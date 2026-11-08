"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

export function NotificationBell() {
  const { data } = useSession();
  const [unread, setUnread] = useState(0);
  const userId = data?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = () =>
      fetch("/api/me/notifications")
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d: { unread: number }) => live && setUnread(d.unread))
        .catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [userId]);
  if (!userId) return null;
  return (
    <Link href="/notifications" className="icon-btn relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {unread ? (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--c-trap)] px-1 text-[0.6rem] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
