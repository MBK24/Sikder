import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getSession, hasRole } from "./auth";
import { can, getEntitlement } from "./entitlements";
import { hasPrivilege } from "./reputation";
import { userMarkdownToHtml } from "@/lib/content/markdown";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

export const PAGE_SIZE = 20;

/** Everything the forum UI needs to know about the current reader. */
export const getForumViewer = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const ent = await getEntitlement();
  const [profile, fresh] = await Promise.all([
    db.profile.findUnique({ where: { userId: session.user.id }, select: { reputation: true, username: true } }),
    // The session cookie is cached for a few minutes; re-check bans and role against the DB for forum writes.
    db.user.findUnique({ where: { id: session.user.id }, select: { banned: true, banExpires: true, role: true } }),
  ]);
  if (!fresh || (fresh.banned && (!fresh.banExpires || fresh.banExpires > new Date()))) return null;
  const rep = profile?.reputation ?? 0;
  const user = { id: session.user.id, role: fresh.role as Role };
  const verifiedEmail = Boolean(session.user.emailVerified);
  const premium = can(ent, "forum.post");
  return {
    ...user,
    username: profile?.username ?? null,
    rep,
    verifiedEmail,
    isMod: hasRole(user, "MODERATOR"),
    isTutor: hasRole(user, "TUTOR"),
    canPost: premium && verifiedEmail,
    canVote: premium && hasPrivilege(user, rep, "upvote"),
    canReport: hasPrivilege(user, rep, "report"),
    canEditTags: hasPrivilege(user, rep, "editTags"),
    canCreateTags: hasPrivilege(user, rep, "createTags"),
    canEditOthers: hasRole(user, "MODERATOR") || hasPrivilege(user, rep, "editOthersPosts"),
    canMarkPriority: can(ent, "forum.priority"),
    premium,
  };
});
export type ForumViewer = NonNullable<Awaited<ReturnType<typeof getForumViewer>>>;

export const authorSelect = {
  id: true,
  name: true,
  role: true,
  profile: { select: { username: true, displayName: true, reputation: true } },
  badges: { select: { badge: { select: { slug: true, label: true, color: true } } } },
} satisfies Prisma.UserSelect;

export type ForumAuthor = Prisma.UserGetPayload<{ select: typeof authorSelect }>;

export type ListTab = "latest" | "unanswered" | "priority" | "top";

export async function listPosts(opts: {
  categoryId?: string;
  tagId?: string;
  chapterId?: string;
  authorId?: string;
  tab?: ListTab;
  page?: number;
  viewer: { isMod: boolean } | null;
}) {
  const where: Prisma.ForumPostWhereInput = {
    status: opts.viewer?.isMod ? { not: "DELETED" } : { in: ["OPEN", "LOCKED"] },
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.tagId ? { tags: { some: { tagId: opts.tagId } } } : {}),
    ...(opts.chapterId ? { chapterId: opts.chapterId } : {}),
    ...(opts.authorId ? { authorId: opts.authorId } : {}),
    ...(opts.tab === "unanswered" ? { replyCount: 0 } : {}),
    ...(opts.tab === "priority" ? { isPriority: true, hasTutorAnswer: false } : {}),
  };
  const orderBy: Prisma.ForumPostOrderByWithRelationInput[] =
    opts.tab === "top"
      ? [{ score: "desc" }, { createdAt: "desc" }]
      : opts.tab === "priority"
        ? [{ createdAt: "asc" }] // oldest waiting first
        : [{ lastActivityAt: "desc" }];
  const page = Math.max(1, opts.page ?? 1);
  const [total, posts] = await Promise.all([
    db.forumPost.count({ where }),
    db.forumPost.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        isPriority: true,
        score: true,
        replyCount: true,
        viewCount: true,
        hasTutorAnswer: true,
        acceptedReplyId: true,
        lastActivityAt: true,
        createdAt: true,
        category: { select: { slug: true, name: true } },
        chapter: { select: { slug: true, title: true } },
        tags: { select: { tag: { select: { slug: true, name: true } } } },
        author: { select: authorSelect },
      },
    }),
  ]);
  // `now` is stamped with the data so relative times ("3h ago") render consistently.
  return { total, posts, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), now: Date.now() };
}

export async function getPostDetail(postId: string, viewer: ForumViewer | null) {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: authorSelect },
      category: true,
      chapter: { select: { slug: true, title: true, part: true } },
      tags: { select: { tag: true } },
      replies: {
        where: viewer?.isMod ? { status: { not: "DELETED" } } : { OR: [{ status: "OPEN" }, ...(viewer ? [{ authorId: viewer.id, status: "HIDDEN" as const }] : [])] },
        include: { author: { select: authorSelect } },
        orderBy: [{ byVerified: "desc" }, { score: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!post || post.status === "DELETED") return null;
  if (post.status === "HIDDEN" && !viewer?.isMod && viewer?.id !== post.authorId) return null;

  const votes = viewer
    ? await db.vote.findMany({
        where: { userId: viewer.id, OR: [{ postId: post.id }, { replyId: { in: post.replies.map((r) => r.id) } }] },
        select: { postId: true, replyId: true },
      })
    : [];
  const voted = new Set(votes.map((v) => v.postId ?? v.replyId));
  // Accepted answer first, then verified (tutor/expert) answers, then by score.
  const replies = [...post.replies].sort((a, b) => Number(b.id === post.acceptedReplyId) - Number(a.id === post.acceptedReplyId));
  return {
    post: { ...post, bodyHtml: userMarkdownToHtml(post.body), voted: voted.has(post.id) },
    replies: replies.map((r) => ({ ...r, bodyHtml: userMarkdownToHtml(r.body), voted: voted.has(r.id) })),
  };
}

export function postHref(p: { id: string; title?: string }) {
  const slug = (p.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `/forum/p/${p.id}${slug ? `/${slug}` : ""}`;
}
