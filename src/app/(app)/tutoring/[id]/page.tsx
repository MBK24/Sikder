import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { MessageForm, StatusControls } from "@/components/tutoring/TutoringControls";
import { userMarkdownToHtml } from "@/lib/content/markdown";
import { LocalTime } from "@/components/ui/LocalTime";

export const metadata: Metadata = { title: "Tutoring request", robots: { index: false } };

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Link href="/tutoring" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Tutoring sessions
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Request params={params} />
      </Suspense>
    </div>
  );
}

async function Request({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/tutoring/${id}`);
  const req = await db.tutoringRequest.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, profile: { select: { username: true, displayName: true } } } },
      tutor: { select: { id: true, name: true, profile: { select: { username: true, displayName: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true, profile: { select: { displayName: true } } } } } },
    },
  });
  if (!req || (req.studentId !== user.id && req.tutorId !== user.id)) notFound();
  const isTutor = req.tutorId === user.id;
  const other = isTutor ? req.student : req.tutor;
  const name = (u: { name: string | null; profile: { displayName: string | null } | null }) => u.profile?.displayName || u.name || "Member";
  const times = (req.proposedTimes as { text?: string } | null)?.text;
  return (
    <>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{req.topic}</h1>
      <p className="mt-1 text-sm text-muted">
        {isTutor ? "Request from " : "With "}
        {other.profile ? (
          <Link className="underline" href={`/u/${other.profile.username}`}>
            {name(other)}
          </Link>
        ) : (
          name(other)
        )}{" "}
        · <span className="badge">{req.status.toLowerCase()}</span>
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border border-[var(--c-border)] p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Student&apos;s availability</dt>
          <dd className="text-muted">{times ?? "–"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Session</dt>
          <dd className="text-muted">
            {req.scheduledFor ? (
              <>
                <LocalTime iso={req.scheduledFor.toISOString()} />
                {req.durationMin ? ` · ${req.durationMin} min` : ""}
              </>
            ) : (
              "Not scheduled yet"
            )}
            {req.meetingLink ? (
              <>
                {" · "}
                <a href={req.meetingLink} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--c-accent)] underline">
                  Join link
                </a>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <StatusControls requestId={req.id} isTutor={isTutor} status={req.status} />
      </div>

      <section className="mt-8" aria-labelledby="msgs">
        <h2 id="msgs" className="text-lg font-semibold">
          Messages
        </h2>
        <ol className="mt-3 space-y-3">
          <li className="rounded-lg bg-[var(--c-bg-subtle)] p-3">
            <p className="text-xs text-muted">{name(req.student)} · original request</p>
            <div className="prose mt-1 !text-[0.95rem]" dangerouslySetInnerHTML={{ __html: userMarkdownToHtml(req.message) }} />
          </li>
          {req.messages.map((m) => (
            <li key={m.id} className={clsx("rounded-lg p-3", m.senderId === user.id ? "ml-8 border border-[var(--c-accent)]" : "mr-8 bg-[var(--c-bg-subtle)]")}>
              <p className="text-xs text-muted">
                {m.senderId === user.id ? "You" : name(m.sender)} · {m.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <div className="prose mt-1 !text-[0.95rem]" dangerouslySetInnerHTML={{ __html: userMarkdownToHtml(m.body) }} />
            </li>
          ))}
        </ol>
        {!["DECLINED", "CANCELED"].includes(req.status) ? (
          <div className="mt-4">
            <MessageForm requestId={req.id} />
          </div>
        ) : null}
      </section>
    </>
  );
}
