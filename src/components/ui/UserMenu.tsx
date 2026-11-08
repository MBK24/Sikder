"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isPending) return <span className="inline-block h-8 w-16" aria-hidden />;
  if (!data) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className="whitespace-nowrap px-2 py-1 text-sm font-semibold hover:text-[var(--c-accent)]">
          Sign in
        </Link>
        <Link href="/sign-up" className="btn btn-primary hidden !py-1.5 sm:inline-flex">
          Start free
        </Link>
      </div>
    );
  }
  const user = data.user;
  const role = (user as { role?: string }).role ?? "STUDENT";
  const staffLinks: [string, string][] = [
    ...(["TUTOR", "EXPERT", "MODERATOR", "ADMIN"].includes(role) ? [["/tutor", "Tutor workspace"] as [string, string]] : []),
    ...(["MODERATOR", "ADMIN"].includes(role) ? [["/admin/moderation", "Moderation"] as [string, string]] : []),
    ...(role === "ADMIN" ? [["/admin/verifications", "Verifications"] as [string, string]] : []),
  ];
  const initial = (user.name || user.email).slice(0, 1).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--c-accent)] text-sm font-bold text-[var(--c-bg)]"
      >
        <span className="sr-only">Account menu for </span>
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)] py-1 text-sm shadow-lg"
        >
          <div className="border-b border-[var(--c-border)] px-3 py-2">
            <p className="truncate font-semibold">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          {[
            ["/account", "Account & profile"],
            ["/analytics", "My progress"],
            ["/tutoring", "Tutoring sessions"],
            ["/notifications", "Notifications"],
            ...staffLinks,
          ].map(([href, label]) => (
            <Link key={href} role="menuitem" href={href} className="block px-3 py-2 hover:bg-[var(--c-bg-subtle)]" onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <button
            role="menuitem"
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-[var(--c-bg-subtle)]"
            onClick={async () => {
              await signOut();
              setOpen(false);
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
