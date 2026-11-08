import Link from "next/link";
import clsx from "clsx";
import { connection } from "next/server";
import { getForumViewer, listPosts, type ListTab } from "@/server/forum";
import { PostList } from "./PostList";

type SP = Record<string, string | string[] | undefined>;

/** Tabs + paginated post list. Shared by the forum home, category, tag, and chapter pages. */
export async function ForumListing({
  searchParams,
  basePath,
  filter,
  empty,
}: {
  searchParams: Promise<SP>;
  basePath: string;
  filter: { categoryId?: string; tagId?: string; chapterId?: string };
  empty: React.ReactNode;
}) {
  await connection();
  const sp = await searchParams;
  const viewer = await getForumViewer();
  const tabs: { id: ListTab; label: string }[] = [
    { id: "latest", label: "Latest" },
    { id: "unanswered", label: "Unanswered" },
    { id: "top", label: "Top" },
    ...(viewer?.isTutor ? [{ id: "priority" as const, label: "Priority queue" }] : []),
  ];
  const tab = (tabs.find((t) => t.id === sp.tab)?.id ?? "latest") as ListTab;
  const page = Math.max(1, Number(sp.page) || 1);
  const { posts, pages, total, now } = await listPosts({ ...filter, tab, page, viewer });
  const href = (o: { tab?: string; page?: number }) => {
    const u = new URLSearchParams();
    const t = o.tab ?? tab;
    if (t !== "latest") u.set("tab", t);
    if (o.page && o.page > 1) u.set("page", String(o.page));
    const q = u.toString();
    return `${basePath}${q ? `?${q}` : ""}`;
  };
  return (
    <>
      <nav aria-label="Sort questions" className="mb-3 flex flex-wrap gap-1 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id, page: 1 })}
            aria-current={t.id === tab ? "page" : undefined}
            className={clsx("rounded-full px-3 py-1", t.id === tab ? "bg-[var(--c-accent-soft)] font-semibold text-[var(--c-accent)]" : "text-muted hover:text-[var(--c-fg)]")}
          >
            {t.label}
          </Link>
        ))}
        <span className="ml-auto self-center text-xs text-muted">{total} question{total === 1 ? "" : "s"}</span>
      </nav>
      <PostList posts={posts} now={now} empty={empty} />
      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex justify-between text-sm">
          {page > 1 ? (
            <Link className="btn btn-ghost" href={href({ page: page - 1 })}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link className="btn btn-ghost" href={href({ page: page + 1 })}>
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export async function AskButton({ query = "" }: { query?: string }) {
  const viewer = await getForumViewer();
  if (!viewer) return <Link href="/sign-in?next=/forum" className="btn btn-primary">Sign in to ask</Link>;
  if (!viewer.premium) return <Link href="/pricing" className="btn btn-ghost">Ask a question (Premium)</Link>;
  return (
    <Link href={`/forum/new${query}`} className="btn btn-primary">
      Ask a question
    </Link>
  );
}
