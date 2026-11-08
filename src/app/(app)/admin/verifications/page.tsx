import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { reviewVerification } from "@/server/actions/verification";

export const metadata: Metadata = { title: "Verifications", robots: { index: false } };

export default function VerificationsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await connection();
  await requireRole("ADMIN");
  const pending = await db.verificationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { applicant: { select: { email: true, emailVerified: true, createdAt: true, profile: { select: { username: true, reputation: true } } } } },
  });
  const recent = await db.verificationRequest.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { reviewedAt: "desc" },
    take: 15,
    include: { applicant: { select: { profile: { select: { username: true } } } } },
  });
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Tutor & expert verifications</h1>
      <ul className="mt-6 space-y-4">
        {pending.map((r) => {
          const d = r.details as { credential?: string; score?: number; experience?: string; link?: string };
          return (
            <li key={r.id} className="rounded-lg border border-[var(--c-border)] p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge">{r.kind.toLowerCase()}</span>
                <Link href={`/u/${r.applicant.profile?.username}`} className="font-semibold underline">
                  @{r.applicant.profile?.username}
                </Link>
                <span className="text-muted">
                  {r.applicant.email} · {r.applicant.profile?.reputation ?? 0} rep · joined {r.applicant.createdAt.toLocaleDateString()} · applied {r.createdAt.toLocaleDateString()}
                </span>
              </div>
              <p className="mt-3 font-semibold">{d.credential}</p>
              {d.score ? <p className="text-sm">Reported score: {d.score}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{d.experience}</p>
              {d.link ? (
                <a href={d.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-[var(--c-accent)] underline">
                  {d.link}
                </a>
              ) : null}
              <form action={reviewVerification} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="requestId" value={r.id} />
                <label className="flex-1 text-xs">
                  Note to applicant (optional)
                  <input name="note" className="input" maxLength={1000} />
                </label>
                <button name="decision" value="APPROVED" className="btn btn-primary">
                  Approve
                </button>
                <button name="decision" value="REJECTED" className="btn btn-ghost">
                  Reject
                </button>
              </form>
            </li>
          );
        })}
        {!pending.length ? <li className="text-muted">No pending applications.</li> : null}
      </ul>
      <h2 className="mt-10 text-lg font-semibold">Recently decided</h2>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {recent.map((r) => (
          <li key={r.id}>
            @{r.applicant.profile?.username} · {r.kind.toLowerCase()} · {r.status.toLowerCase()} · {r.reviewedAt?.toLocaleDateString()}
          </li>
        ))}
      </ul>
    </>
  );
}
