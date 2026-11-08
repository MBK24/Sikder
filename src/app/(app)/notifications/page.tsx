import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import clsx from "clsx";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { markAllRead } from "@/server/actions/notifications";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await connection();
  const user = await requireUser("/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  // Viewing the page marks everything as read (after we've captured which were unread for display).
  if (unread) await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        {unread ? (
          <form action={markAllRead}>
            <button className="btn btn-ghost !py-1 text-sm">Mark all read</button>
          </form>
        ) : null}
      </div>
      {items.length ? (
        <ul className="mt-6 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
          {items.map((n) => (
            <li key={n.id} className={clsx("py-3", !n.readAt && "border-l-2 border-[var(--c-accent)] pl-3")}>
              {n.href ? (
                <Link href={n.href} className="font-semibold hover:text-[var(--c-accent)]">
                  {n.title}
                </Link>
              ) : (
                <p className="font-semibold">{n.title}</p>
              )}
              {n.body ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p> : null}
              <p className="mt-1 text-xs text-muted">{n.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted">Nothing yet. You&apos;ll be notified here when someone answers your questions or accepts your answers.</p>
      )}
    </>
  );
}
