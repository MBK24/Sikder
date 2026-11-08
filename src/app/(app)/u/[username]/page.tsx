import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getSession, hasRole } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { tutoringQuota } from "@/server/tutoring";
import { authorSelect, postHref } from "@/server/forum";
import { RoleBadge } from "@/components/forum/AuthorChip";
import { RequestForm } from "@/components/tutoring/RequestForm";
import { userMarkdownToHtml } from "@/lib/content/markdown";
import { PART_LABEL } from "@/server/practice";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await db.profile.findUnique({ where: { username: (await params).username }, select: { displayName: true, username: true, user: { select: { role: true } } } });
  if (!p) return {};
  const name = p.displayName || p.username;
  return { title: hasRole(p.user, "TUTOR") ? `${name}, MCAT tutor` : name };
}

export default function ProfilePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: Props) {
  const { username } = await params;
  const profile = await db.profile.findUnique({
    where: { username },
    include: { user: { select: { ...authorSelect, createdAt: true, banned: true } } },
  });
  if (!profile || profile.user.banned) notFound();
  const u = profile.user;
  const isTutor = hasRole(u, "TUTOR");
  const [questions, answers, accepted, recentPosts, recentAnswers] = await Promise.all([
    db.forumPost.count({ where: { authorId: u.id, status: { in: ["OPEN", "LOCKED"] } } }),
    db.forumReply.count({ where: { authorId: u.id, status: "OPEN" } }),
    db.forumPost.count({ where: { acceptedReply: { authorId: u.id } } }),
    db.forumPost.findMany({ where: { authorId: u.id, status: { in: ["OPEN", "LOCKED"] } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, score: true } }),
    db.forumReply.findMany({
      where: { authorId: u.id, status: "OPEN", post: { status: { in: ["OPEN", "LOCKED"] } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, score: true, post: { select: { id: true, title: true, acceptedReplyId: true } } },
    }),
  ]);
  const name = profile.displayName || u.name || profile.username;

  return (
    <>
      <header className="flex flex-wrap items-start gap-5">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--c-accent)] text-2xl font-bold text-[var(--c-bg)]" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>@{profile.username}</span>
            <RoleBadge role={u.role} />
            {u.badges.map((b) => (
              <span key={b.badge.slug} className="badge">
                {b.badge.label}
              </span>
            ))}
          </p>
          {isTutor && profile.tutorHeadline ? <p className="mt-2 font-serif text-lg">{profile.tutorHeadline}</p> : null}
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Reputation", profile.reputation.toLocaleString()],
          ["Questions", questions],
          ["Answers", answers],
          ["Accepted answers", accepted],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-[var(--c-border)] p-3">
            <dt className="text-xs text-muted">{l}</dt>
            <dd className="text-xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {profile.bio ? <div className="prose book-prose mt-6 !text-base" dangerouslySetInnerHTML={{ __html: userMarkdownToHtml(profile.bio) }} /> : null}

      {isTutor ? (
        <section className="mt-10 rounded-lg border border-[var(--c-conn)] p-5" aria-labelledby="tutoring">
          <h2 id="tutoring" className="text-lg font-semibold">
            Tutoring
          </h2>
          <p className="mt-1 text-sm text-muted">
            {profile.tutorSubjects.length ? `Sections: ${profile.tutorSubjects.map((s) => PART_LABEL[s as keyof typeof PART_LABEL] ?? s).join(", ")}. ` : ""}
            {profile.tutorAvailability ?? ""}
          </p>
          <div className="mt-4">
            <Suspense fallback={null}>
              <RequestBox tutorId={u.id} tutorName={name} accepting={profile.acceptingRequests} />
            </Suspense>
          </div>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Recent questions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {recentPosts.length ? recentPosts.map((p) => (
              <li key={p.id} className="flex gap-2">
                <span className="w-8 shrink-0 text-right tabular-nums text-muted">{p.score}</span>
                <Link href={postHref(p)} className="hover:text-[var(--c-accent)]">
                  {p.title}
                </Link>
              </li>
            )) : <li className="text-muted">None yet.</li>}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Recent answers</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {recentAnswers.length ? recentAnswers.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="w-8 shrink-0 text-right tabular-nums text-muted">{r.score}</span>
                <Link href={`${postHref(r.post)}#reply-${r.id}`} className="hover:text-[var(--c-accent)]">
                  {r.post.acceptedReplyId === r.id ? <span className="mr-1 text-[var(--c-ok)]">✓</span> : null}
                  {r.post.title}
                </Link>
              </li>
            )) : <li className="text-muted">None yet.</li>}
          </ul>
        </section>
      </div>
      <p className="mt-10 text-xs text-muted">Member since {u.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
    </>
  );
}

async function RequestBox({ tutorId, tutorName, accepting }: { tutorId: string; tutorName: string; accepting: boolean }) {
  const s = await getSession();
  if (!accepting) return <p className="text-sm text-muted">{tutorName} isn&apos;t taking new session requests right now.</p>;
  if (!s) {
    return (
      <p className="text-sm">
        <Link href="/sign-in" className="font-semibold text-[var(--c-accent)] underline">
          Sign in
        </Link>{" "}
        to request a session.
      </p>
    );
  }
  if (s.user.id === tutorId) return <p className="text-sm text-muted">This is how students see your tutoring card.</p>;
  const ent = await getEntitlement();
  if (!can(ent, "tutoring.request")) {
    return (
      <p className="text-sm">
        Requesting 1:1 sessions is included with{" "}
        <Link href="/pricing" className="font-semibold text-[var(--c-accent)] underline">
          Premium + Tutoring
        </Link>
        .
      </p>
    );
  }
  const q = await tutoringQuota(s.user.id, ent);
  return <RequestForm tutorId={tutorId} tutorName={tutorName} remaining={q.remaining} limit={q.limit} />;
}
