import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { postHref } from "@/server/forum";
import { banUser, unbanUser } from "@/server/actions/moderation";
import { ResolveButtons } from "@/components/admin/ModerationRow";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

export default function ModerationPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await connection();
  await requireRole("MODERATOR");
  const [reports, hidden, banned, actions] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        reporter: { select: { profile: { select: { username: true } } } },
        post: { select: { id: true, title: true, body: true, status: true, authorId: true, author: { select: { profile: { select: { username: true } } } } } },
        reply: { select: { id: true, body: true, status: true, authorId: true, post: { select: { id: true, title: true } }, author: { select: { profile: { select: { username: true } } } } } },
        targetUser: { select: { id: true, profile: { select: { username: true } } } },
      },
    }),
    db.forumPost.findMany({ where: { status: { in: ["HIDDEN", "LOCKED"] } }, orderBy: { lastActivityAt: "desc" }, take: 30, select: { id: true, title: true, status: true } }),
    db.user.findMany({ where: { banned: true }, select: { id: true, email: true, banReason: true, banExpires: true, profile: { select: { username: true } } } }),
    db.moderationAction.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { profile: { select: { username: true } } } }, targetUser: { select: { profile: { select: { username: true } } } } } }),
  ]);
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Moderation queue</h1>
      <section className="mt-6" aria-labelledby="reports">
        <h2 id="reports" className="text-lg font-semibold">
          Open reports ({reports.length})
        </h2>
        {reports.length ? (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => {
              const authorId = r.post?.authorId ?? r.reply?.authorId ?? r.targetUser?.id;
              const href = r.post ? postHref(r.post) : r.reply ? `${postHref(r.reply.post)}#reply-${r.reply.id}` : r.targetUser?.profile ? `/u/${r.targetUser.profile.username}` : null;
              const excerpt = (r.post?.body ?? r.reply?.body ?? "").slice(0, 280);
              return (
                <li key={r.id} className="rounded-lg border border-[var(--c-border)] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="badge !text-[var(--c-trap)]">{r.reason}</span>
                    <span className="text-muted">
                      {r.target.toLowerCase()} by @{r.post?.author.profile?.username ?? r.reply?.author.profile?.username ?? r.targetUser?.profile?.username} · reported by @
                      {r.reporter.profile?.username} · {r.createdAt.toLocaleDateString()}
                    </span>
                    <span className="ml-auto">
                      <ResolveButtons reportId={r.id} />
                    </span>
                  </div>
                  {href ? (
                    <Link href={href} className="mt-2 block font-semibold hover:text-[var(--c-accent)]">
                      {r.post?.title ?? r.reply?.post.title ?? "View profile"}
                    </Link>
                  ) : null}
                  {excerpt ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{excerpt}</p> : null}
                  {r.details ? <p className="mt-2 text-sm">Reporter&apos;s note: {r.details}</p> : null}
                  {authorId ? (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted">Ban this author…</summary>
                      <form action={banUser} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="userId" value={authorId} />
                        <label className="text-xs">
                          Days (0 = permanent)
                          <input name="days" type="number" min={0} max={3650} defaultValue={7} className="input !w-24" />
                        </label>
                        <label className="flex-1 text-xs">
                          Reason
                          <input name="reason" className="input" required minLength={3} maxLength={500} />
                        </label>
                        <ConfirmButton message="Ban this user? Their sessions will be signed out." className="btn btn-ghost !text-[var(--c-trap)]">
                          Ban
                        </ConfirmButton>
                      </form>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing to review. 🎉</p>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="hidden">
          <h2 id="hidden" className="text-lg font-semibold">
            Hidden & locked threads
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {hidden.map((p) => (
              <li key={p.id}>
                <span className="badge mr-2">{p.status.toLowerCase()}</span>
                <Link href={postHref(p)} className="hover:text-[var(--c-accent)]">
                  {p.title}
                </Link>
              </li>
            ))}
            {!hidden.length ? <li className="text-muted">None.</li> : null}
          </ul>
        </section>
        <section aria-labelledby="banned">
          <h2 id="banned" className="text-lg font-semibold">
            Banned users
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {banned.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">@{u.profile?.username ?? u.email}</span>
                <span className="text-muted">
                  {u.banReason} · {u.banExpires ? `until ${u.banExpires.toLocaleDateString()}` : "permanent"}
                </span>
                <form action={unbanUser.bind(null, u.id)} className="ml-auto">
                  <button className="text-xs underline">Unban</button>
                </form>
              </li>
            ))}
            {!banned.length ? <li className="text-muted">None.</li> : null}
          </ul>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="log">
        <h2 id="log" className="text-lg font-semibold">
          Recent moderator actions
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {actions.map((a) => (
            <li key={a.id}>
              {a.createdAt.toLocaleString()} · @{a.actor.profile?.username} · {a.type.toLowerCase().replace(/_/g, " ")}
              {a.targetUser?.profile ? ` · @${a.targetUser.profile.username}` : ""}
              {a.reason ? ` · ${a.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
