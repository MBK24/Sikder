import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { db } from "@/server/db";
import { getForumViewer, getPostDetail, postHref, type ForumViewer } from "@/server/forum";
import { createReply } from "@/server/actions/forum";
import { AuthorChip } from "@/components/forum/AuthorChip";
import { VoteButton } from "@/components/forum/VoteButton";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { AcceptButton, EditReply, ModPostTools, ModReplyTools, ReportButton } from "@/components/forum/PostControls";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));
type Props = { params: Promise<{ postId: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await db.forumPost.findUnique({ where: { id: (await params).postId }, select: { title: true, body: true, status: true, id: true } });
  if (!p || p.status === "DELETED" || p.status === "HIDDEN") return { title: "Forum", robots: { index: false } };
  const description = p.body.replace(/[#*_`>$\\[\]()!]/g, "").replace(/\s+/g, " ").slice(0, 160);
  return { title: p.title, description, alternates: { canonical: postHref(p) }, openGraph: { type: "article", title: p.title, description } };
}

export default function PostPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Thread params={params} />
      </Suspense>
    </div>
  );
}

function when(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function voteBlocker(v: ForumViewer | null) {
  if (!v) return "Sign in to vote.";
  if (!v.premium) return "Voting is part of Premium.";
  if (!v.canVote) return "Voting unlocks with a little more reputation.";
  return undefined;
}

async function Thread({ params }: Props) {
  const { postId } = await params;
  const viewer = await getForumViewer();
  const data = await getPostDetail(postId, viewer);
  if (!data) notFound();
  const { post, replies } = data;
  await db.forumPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  const uploadsEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const isAuthor = viewer?.id === post.authorId;
  const blocker = voteBlocker(viewer);
  const chapterHref = post.chapter ? `/${ENUM_TO_CODE[post.chapter.part]}/${post.chapter.slug}${post.chapterAnchor ? `#${post.chapterAnchor}` : ""}` : null;

  return (
    <>
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/forum" className="hover:text-[var(--c-accent)]">
          Forum
        </Link>{" "}
        /{" "}
        <Link href={`/forum/c/${post.category.slug}`} className="hover:text-[var(--c-accent)]">
          {post.category.name}
        </Link>
      </nav>
      <h1 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Asked {when(post.createdAt)}</span>
        <span>· {post.viewCount + 1} views</span>
        {post.isPriority ? <span className="badge !border-[var(--c-conn)] !text-[var(--c-conn)]">Priority</span> : null}
        {post.status === "LOCKED" ? <span className="badge">Locked</span> : null}
        {post.status === "HIDDEN" ? <span className="badge !text-[var(--c-trap)]">Hidden by a moderator</span> : null}
        {chapterHref ? (
          <Link href={chapterHref} className="hover:text-[var(--c-accent)]">
            · About <strong>{post.chapter!.title}</strong>
          </Link>
        ) : null}
      </div>

      <article className="mt-6 flex gap-4 border-b border-[var(--c-border)] pb-6">
        <VoteButton target={{ postId: post.id }} initialScore={post.score} initialVoted={post.voted} disabledReason={isAuthor ? "You can't vote on your own question." : blocker} />
        <div className="min-w-0 flex-1">
          <div className="prose book-prose !text-[1.02rem]" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map(({ tag }) => (
              <Link key={tag.slug} href={`/forum/t/${tag.slug}`} className="rounded bg-[var(--c-accent-soft)] px-1.5 py-0.5 text-xs text-[var(--c-accent)]">
                {tag.name}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <AuthorChip author={post.author} size="md" />
            {post.editedAt ? <span className="text-xs text-muted">edited {when(post.editedAt)}</span> : null}
            <span className="ml-auto flex items-center gap-3">
              {viewer && (isAuthor || viewer.canEditOthers || viewer.canEditTags) ? (
                <Link href={`/forum/p/${post.id}/edit`} className="text-xs text-muted hover:text-[var(--c-accent)]">
                  Edit
                </Link>
              ) : null}
              {viewer && !isAuthor ? <ReportButton target={{ postId: post.id }} /> : null}
              {viewer?.isMod ? <ModPostTools postId={post.id} status={post.status} /> : null}
            </span>
          </div>
        </div>
      </article>

      <h2 className="mt-8 text-lg font-semibold">
        {replies.length} {replies.length === 1 ? "answer" : "answers"}
      </h2>
      <ol className="mt-2">
        {replies.map((r) => {
          const accepted = r.id === post.acceptedReplyId;
          const mine = viewer?.id === r.authorId;
          return (
            <li
              key={r.id}
              id={`reply-${r.id}`}
              className={clsx("flex scroll-mt-24 gap-4 border-b border-[var(--c-border)] py-5 pl-3", accepted ? "answer-accepted" : r.byVerified ? "answer-verified" : "", r.status === "HIDDEN" && "opacity-60")}
            >
              <div className="flex flex-col items-center gap-2">
                <VoteButton target={{ replyId: r.id }} initialScore={r.score} initialVoted={r.voted} disabledReason={mine ? "You can't vote on your own answer." : blocker} />
                {accepted ? (
                  <span className="text-[var(--c-ok)]" title="Accepted answer" role="img" aria-label="Accepted answer">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                {accepted || r.byVerified ? (
                  <p className="mb-2 text-xs font-semibold">
                    {accepted ? <span className="text-[var(--c-ok)]">Accepted answer</span> : null}
                    {accepted && r.byVerified ? " · " : null}
                    {r.byVerified ? <span className="text-[var(--c-conn)]">Answer from a verified {r.author.role === "EXPERT" ? "expert" : "tutor"}</span> : null}
                  </p>
                ) : null}
                {r.status === "HIDDEN" ? <p className="mb-2 text-xs text-[var(--c-trap)]">Hidden by a moderator</p> : null}
                <div className="prose book-prose !text-[1.02rem]" dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <AuthorChip author={r.author} />
                  <span className="text-xs text-muted">
                    {when(r.createdAt)}
                    {r.editedAt ? " · edited" : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {isAuthor && r.status === "OPEN" ? <AcceptButton postId={post.id} replyId={r.id} accepted={accepted} /> : null}
                    {viewer && (mine || viewer.canEditOthers) ? <EditReply replyId={r.id} body={r.body} uploadsEnabled={uploadsEnabled} userId={viewer.id} /> : null}
                    {viewer && !mine ? <ReportButton target={{ replyId: r.id }} /> : null}
                    {viewer?.isMod ? <ModReplyTools replyId={r.id} hidden={r.status === "HIDDEN"} /> : null}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-10" aria-label="Post an answer">
        {post.status === "LOCKED" ? (
          <p className="rounded-lg border border-[var(--c-border)] p-4 text-sm text-muted">This thread is locked, so new answers are closed.</p>
        ) : !viewer ? (
          <p className="rounded-lg border border-[var(--c-border)] p-4 text-sm">
            <Link href={`/sign-in?next=${encodeURIComponent(postHref(post))}`} className="font-semibold text-[var(--c-accent)] underline">
              Sign in
            </Link>{" "}
            to answer.
          </p>
        ) : !viewer.premium ? (
          <p className="rounded-lg border border-[var(--c-accent)] bg-[var(--c-accent-soft)] p-4 text-sm">
            Reading the forum is free. <Link href="/pricing" className="font-semibold underline">Premium</Link> lets you ask, answer, and vote.
          </p>
        ) : !viewer.verifiedEmail ? (
          <p className="rounded-lg border border-[var(--c-border)] p-4 text-sm">Confirm your email address to answer. Check your inbox for the link we sent.</p>
        ) : (
          <ReplyForm action={createReply.bind(null, post.id)} uploadsEnabled={uploadsEnabled} userId={viewer.id} />
        )}
      </section>
    </>
  );
}
