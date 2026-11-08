import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { listPosts } from "@/server/forum";
import { PostList } from "@/components/forum/PostList";
import { TutorProfileForm } from "@/components/tutoring/TutoringControls";

export const metadata: Metadata = { title: "Tutor workspace", robots: { index: false } };

export default function TutorPage() {
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Tutor workspace</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Workspace />
      </Suspense>
    </div>
  );
}

async function Workspace() {
  await connection();
  const user = await requireRole("TUTOR");
  const [priority, unanswered, profile, pendingRequests] = await Promise.all([
    listPosts({ tab: "priority", viewer: { isMod: false } }),
    listPosts({ tab: "unanswered", viewer: { isMod: false } }),
    db.profile.findUnique({ where: { userId: user.id } }),
    db.tutoringRequest.count({ where: { tutorId: user.id, status: "PENDING" } }),
  ]);
  return (
    <>
      <p className="mt-2 text-muted">
        {pendingRequests ? (
          <Link href="/tutoring" className="font-semibold text-[var(--c-accent)] underline">
            {pendingRequests} session request{pendingRequests === 1 ? "" : "s"} waiting
          </Link>
        ) : (
          "No session requests waiting."
        )}
      </p>
      <section className="mt-8" aria-labelledby="pq">
        <h2 id="pq" className="text-xl font-semibold">
          Priority queue
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">Questions from Premium + Tutoring members that no tutor has answered yet, oldest first.</p>
        <PostList posts={priority.posts} now={priority.now} empty="The priority queue is empty. Nice work." />
      </section>
      <section className="mt-10" aria-labelledby="ua">
        <h2 id="ua" className="text-xl font-semibold">
          Unanswered
        </h2>
        <div className="mt-3">
          <PostList posts={unanswered.posts.slice(0, 10)} now={unanswered.now} empty="Every question has an answer." />
        </div>
      </section>
      <section className="mt-10 max-w-[640px]" aria-labelledby="tp">
        <h2 id="tp" className="text-xl font-semibold">
          Your tutoring profile
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Shown on your{" "}
          <Link className="underline" href={`/u/${profile?.username}`}>
            public profile
          </Link>
          , where students can request sessions.
        </p>
        <TutorProfileForm
          initial={{
            headline: profile?.tutorHeadline ?? "",
            availability: profile?.tutorAvailability ?? "",
            accepting: profile?.acceptingRequests ?? false,
            subjects: profile?.tutorSubjects ?? [],
          }}
        />
      </section>
    </>
  );
}
