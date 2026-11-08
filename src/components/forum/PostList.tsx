import Link from "next/link";
import clsx from "clsx";
import { postHref } from "@/server/forum";
import { AuthorChip, type ChipAuthor } from "./AuthorChip";

export interface ListPost {
  id: string;
  title: string;
  status: string;
  isPriority: boolean;
  score: number;
  replyCount: number;
  hasTutorAnswer: boolean;
  acceptedReplyId: string | null;
  lastActivityAt: Date;
  category: { slug: string; name: string };
  chapter: { slug: string; title: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  author: ChipAuthor;
}

function ago(d: Date, now: number) {
  const s = Math.max(1, Math.round((now - d.getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 30 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PostList({ posts, now, empty }: { posts: ListPost[]; now: number; empty: React.ReactNode }) {
  if (!posts.length) return <div className="rounded-lg border border-dashed border-[var(--c-border)] p-8 text-center text-muted">{empty}</div>;
  return (
    <ul className="divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
      {posts.map((p) => (
        <li key={p.id} className={clsx("flex gap-4 py-4", p.status === "HIDDEN" && "opacity-60")}>
          <div className="hidden w-20 shrink-0 flex-col items-end gap-1 text-xs text-muted sm:flex">
            <span className="tabular-nums">
              <strong className="text-[var(--c-fg)]">{p.score}</strong> votes
            </span>
            <span
              className={clsx(
                "rounded px-1.5 py-0.5 tabular-nums",
                p.acceptedReplyId ? "bg-[var(--c-ok)] text-[var(--c-bg)]" : p.replyCount ? "border border-[var(--c-ok)] text-[var(--c-ok)]" : "",
              )}
            >
              {p.replyCount} {p.replyCount === 1 ? "answer" : "answers"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <Link href={postHref(p)} className="font-semibold leading-snug hover:text-[var(--c-accent)]">
              {p.title}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {p.isPriority ? <span className="badge !border-[var(--c-conn)] !text-[var(--c-conn)]">Priority</span> : null}
              {p.hasTutorAnswer ? <span className="badge !border-[var(--c-conn)] !text-[var(--c-conn)]">Tutor answered</span> : null}
              {p.status === "LOCKED" ? <span className="badge">Locked</span> : null}
              {p.status === "HIDDEN" ? <span className="badge !text-[var(--c-trap)]">Hidden</span> : null}
              <Link href={`/forum/c/${p.category.slug}`} className="badge hover:!text-[var(--c-accent)]">
                {p.category.name}
              </Link>
              {p.tags.map((t) => (
                <Link key={t.tag.slug} href={`/forum/t/${t.tag.slug}`} className="rounded bg-[var(--c-accent-soft)] px-1.5 py-0.5 text-[var(--c-accent)]">
                  {t.tag.name}
                </Link>
              ))}
              {p.chapter ? (
                <Link href={`/forum/chapter/${p.chapter.slug}`} className="text-muted hover:text-[var(--c-accent)]">
                  · {p.chapter.title}
                </Link>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <AuthorChip author={p.author} showBadges={false} />
              <span>· active {ago(p.lastActivityAt, now)}</span>
              <span className="sm:hidden">
                · {p.score} votes · {p.replyCount} answers
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
