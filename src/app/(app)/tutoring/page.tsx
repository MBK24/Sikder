import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser, hasRole } from "@/server/auth";
import { db } from "@/server/db";
import { can, getEntitlement } from "@/server/entitlements";
import { tutoringQuota } from "@/server/tutoring";

export const metadata: Metadata = { title: "Tutoring sessions", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = { PENDING: "Waiting for tutor", ACCEPTED: "Accepted", DECLINED: "Declined", SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELED: "Canceled" };

export default function TutoringPage() {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Tutoring sessions</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Lists />
      </Suspense>
    </div>
  );
}

async function Lists() {
  const user = await requireUser("/tutoring");
  const ent = await getEntitlement();
  const select = {
    id: true,
    topic: true,
    status: true,
    scheduledFor: true,
    updatedAt: true,
    student: { select: { name: true, profile: { select: { username: true, displayName: true } } } },
    tutor: { select: { name: true, profile: { select: { username: true, displayName: true } } } },
  } as const;
  const [asStudent, asTutor, tutors] = await Promise.all([
    db.tutoringRequest.findMany({ where: { studentId: user.id }, orderBy: { updatedAt: "desc" }, select }),
    hasRole(user, "TUTOR") ? db.tutoringRequest.findMany({ where: { tutorId: user.id }, orderBy: { updatedAt: "desc" }, select }) : Promise.resolve([]),
    db.user.findMany({
      where: { role: { in: ["TUTOR", "EXPERT"] }, banned: false, profile: { acceptingRequests: true } },
      select: { name: true, profile: { select: { username: true, displayName: true, tutorHeadline: true, reputation: true } } },
      orderBy: { profile: { reputation: "desc" } },
      take: 12,
    }),
  ]);
  const quota = can(ent, "tutoring.request") ? await tutoringQuota(user.id, ent) : null;
  const row = (r: (typeof asStudent)[number], other: "student" | "tutor") => {
    const o = r[other];
    return (
      <li key={r.id}>
        <Link href={`/tutoring/${r.id}`} className="flex items-center gap-3 py-3 hover:text-[var(--c-accent)]">
          <span className="flex-1">
            <span className="font-semibold">{r.topic}</span>
            <span className="block text-sm text-muted">with {o.profile?.displayName || o.name || o.profile?.username}</span>
          </span>
          <span className="badge">{STATUS_LABEL[r.status]}</span>
        </Link>
      </li>
    );
  };
  return (
    <>
      {hasRole(user, "TUTOR") ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Requests for you</h2>
          {asTutor.length ? <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">{asTutor.map((r) => row(r, "student"))}</ul> : <p className="mt-2 text-sm text-muted">No requests yet.</p>}
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">My requests</h2>
        {quota ? (
          <p className="mt-1 text-sm text-muted">
            {quota.remaining} of {quota.limit} requests left this month.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            1:1 session requests are included with{" "}
            <Link href="/pricing" className="underline">
              Premium + Tutoring
            </Link>
            .
          </p>
        )}
        {asStudent.length ? <ul className="mt-2 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">{asStudent.map((r) => row(r, "tutor"))}</ul> : null}
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Find a tutor</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tutors.map((t) =>
            t.profile ? (
              <li key={t.profile.username}>
                <Link href={`/u/${t.profile.username}`} className="block rounded-lg border border-[var(--c-border)] p-4 hover:border-[var(--c-accent)]">
                  <span className="font-semibold">{t.profile.displayName || t.name}</span>
                  <span className="block text-sm text-muted">{t.profile.tutorHeadline ?? "Verified tutor"}</span>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
        {!tutors.length ? <p className="mt-2 text-sm text-muted">No tutors are taking requests right now.</p> : null}
      </section>
    </>
  );
}
