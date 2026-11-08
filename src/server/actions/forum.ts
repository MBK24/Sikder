"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { getForumViewer, postHref, type ForumViewer } from "@/server/forum";
import { awardVote, revokeVote, setAcceptedRep } from "@/server/reputation";
import { notify } from "@/server/notifications";
import { rateLimit } from "@/server/ratelimit";
import { userMarkdownToHtml } from "@/lib/content/markdown";
import { FORUM_LIMITS } from "@/config/reputation";

export type ForumFormState = { error?: string; ok?: boolean };

async function limited(viewer: ForumViewer, kind: keyof typeof FORUM_LIMITS) {
  const l = FORUM_LIMITS[kind];
  return !(await rateLimit(`forum:${kind}:${viewer.id}`, l.max, l.windowSec));
}

function postingBlocker(v: ForumViewer | null): string | null {
  if (!v) return "Please sign in.";
  if (!v.premium) return "Posting in the forum is part of Premium.";
  if (!v.verifiedEmail) return "Please confirm your email address before posting. Check your inbox for the link.";
  return null;
}

const tagSlug = (t: string) =>
  t
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

/** Resolves tag input to tag ids; unknown tags are created only by users with that privilege. */
async function resolveTags(raw: string, v: ForumViewer) {
  const slugs = [...new Set(raw.split(/[,\s]+/).map(tagSlug).filter((s) => s.length >= 2))].slice(0, 5);
  if (!slugs.length) return { ids: [] as string[] };
  const existing = await db.tag.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const missing = slugs.filter((s) => !existing.some((e) => e.slug === s));
  if (missing.length && !v.canCreateTags) {
    return { error: `Unknown tag${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Choose existing tags (new tags unlock at 500 reputation).` };
  }
  const created = await Promise.all(missing.map((slug) => db.tag.create({ data: { slug, name: slug.replace(/-/g, " ") }, select: { id: true } })));
  return { ids: [...existing.map((e) => e.id), ...created.map((c) => c.id)] };
}

const postSchema = z.object({
  title: z.string().trim().min(15, "Make the title a little more specific (at least 15 characters).").max(150),
  body: z.string().trim().min(30, "Add a bit more detail (at least 30 characters).").max(20_000),
  category: z.string().max(40),
  tags: z.string().max(200).default(""),
  chapter: z.string().max(120).optional(),
  anchor: z.string().max(200).optional(),
  priority: z.literal("on").optional(),
});

export async function createPost(_prev: ForumFormState, form: FormData): Promise<ForumFormState> {
  const v = await getForumViewer();
  const blocked = postingBlocker(v);
  if (blocked) return { error: blocked };
  const parsed = postSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (await limited(v!, "post")) return { error: "You've posted a lot in the last hour. Please wait before asking another question." };
  const d = parsed.data;
  const category = await db.forumCategory.findUnique({ where: { slug: d.category } });
  if (!category) return { error: "Choose a category." };
  const chapter = d.chapter ? await db.chapter.findUnique({ where: { slug: d.chapter }, select: { id: true } }) : null;
  const tags = await resolveTags(d.tags, v!);
  if ("error" in tags) return { error: tags.error };

  const post = await db.forumPost.create({
    data: {
      authorId: v!.id,
      categoryId: category.id,
      chapterId: chapter?.id ?? null,
      chapterAnchor: chapter && d.anchor ? d.anchor : null,
      title: d.title,
      body: d.body,
      isPriority: d.priority === "on" && v!.canMarkPriority,
      tags: { create: tags.ids.map((tagId) => ({ tagId })) },
    },
    select: { id: true, title: true },
  });
  redirect(postHref(post));
}

export async function editPost(postId: string, _prev: ForumFormState, form: FormData): Promise<ForumFormState> {
  const v = await getForumViewer();
  if (!v) return { error: "Please sign in." };
  const post = await db.forumPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true, status: true } });
  if (!post || post.status === "DELETED") return { error: "Post not found." };
  const isAuthor = post.authorId === v.id;
  if (!isAuthor && !v.canEditOthers && !v.canEditTags) return { error: "You can't edit this post." };
  const parsed = postSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const canEditText = isAuthor || v.canEditOthers;
  const tags = await resolveTags(d.tags, v);
  if ("error" in tags) return { error: tags.error };
  const category = await db.forumCategory.findUnique({ where: { slug: d.category } });
  await db.$transaction([
    db.forumPost.update({
      where: { id: post.id },
      data: {
        ...(canEditText ? { title: d.title, body: d.body, editedAt: new Date() } : {}),
        ...(category && canEditText ? { categoryId: category.id } : {}),
      },
    }),
    db.forumPostTag.deleteMany({ where: { postId: post.id } }),
    db.forumPostTag.createMany({ data: tags.ids.map((tagId) => ({ postId: post.id, tagId })) }),
  ]);
  redirect(postHref({ id: post.id, title: d.title }));
}

const replySchema = z.object({ body: z.string().trim().min(20, "Answers need at least 20 characters.").max(20_000) });

export async function createReply(postId: string, _prev: ForumFormState, form: FormData): Promise<ForumFormState> {
  const v = await getForumViewer();
  const blocked = postingBlocker(v);
  if (blocked) return { error: blocked };
  const parsed = replySchema.safeParse({ body: form.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (await limited(v!, "reply")) return { error: "You're replying very quickly. Please wait a few minutes." };
  const post = await db.forumPost.findUnique({ where: { id: postId }, select: { id: true, title: true, authorId: true, status: true } });
  if (!post || post.status !== "OPEN") return { error: post?.status === "LOCKED" ? "This thread is locked." : "Thread not found." };

  const byVerified = v!.isTutor;
  await db.$transaction([
    db.forumReply.create({ data: { postId, authorId: v!.id, body: parsed.data.body, byVerified } }),
    db.forumPost.update({
      where: { id: postId },
      data: { replyCount: { increment: 1 }, lastActivityAt: new Date(), ...(byVerified ? { hasTutorAnswer: true } : {}) },
    }),
  ]);
  await notify({
    userId: post.authorId,
    actorId: v!.id,
    type: "REPLY_TO_POST",
    title: byVerified ? `A verified tutor answered “${post.title}”` : `New answer to “${post.title}”`,
    body: parsed.data.body.slice(0, 280),
    href: postHref(post),
  });
  revalidatePath(postHref(post));
  return { ok: true };
}

export async function editReply(replyId: string, _prev: ForumFormState, form: FormData): Promise<ForumFormState> {
  const v = await getForumViewer();
  if (!v) return { error: "Please sign in." };
  const reply = await db.forumReply.findUnique({ where: { id: replyId }, select: { authorId: true, post: { select: { id: true, title: true } } } });
  if (!reply) return { error: "Answer not found." };
  if (reply.authorId !== v.id && !v.canEditOthers) return { error: "You can't edit this answer." };
  const parsed = replySchema.safeParse({ body: form.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.forumReply.update({ where: { id: replyId }, data: { body: parsed.data.body, editedAt: new Date() } });
  revalidatePath(postHref(reply.post));
  return { ok: true };
}

const voteSchema = z.object({ postId: z.string().max(40).optional(), replyId: z.string().max(40).optional() }).refine((x) => !!x.postId !== !!x.replyId);

/** Toggles the viewer's upvote on a post or reply. Returns the new state. */
export async function toggleVote(raw: z.input<typeof voteSchema>) {
  const v = await getForumViewer();
  if (!v) return { ok: false as const, error: "Please sign in to vote." };
  if (!v.canVote) return { ok: false as const, error: v.premium ? "Voting unlocks with a little more reputation." : "Voting is part of Premium." };
  const { postId, replyId } = voteSchema.parse(raw);
  if (await limited(v, "vote")) return { ok: false as const, error: "Slow down a little." };

  const target = postId
    ? await db.forumPost.findUnique({ where: { id: postId }, select: { authorId: true, status: true } })
    : await db.forumReply.findUnique({ where: { id: replyId }, select: { authorId: true, status: true } });
  if (!target || target.status === "DELETED" || target.status === "HIDDEN") return { ok: false as const, error: "Not found." };
  if (target.authorId === v.id) return { ok: false as const, error: "You can't vote on your own post." };

  const existing = await db.vote.findFirst({ where: { userId: v.id, ...(postId ? { postId } : { replyId }) }, select: { id: true } });
  const result = await db.$transaction(async (tx) => {
    if (existing) {
      await revokeVote(tx, existing.id);
      await tx.vote.delete({ where: { id: existing.id } });
    } else {
      const vote = await tx.vote.create({ data: { userId: v.id, postId: postId ?? null, replyId: replyId ?? null } });
      await awardVote(tx, { voteId: vote.id, voterId: v.id, authorId: target.authorId, postId, replyId });
    }
    const delta = existing ? -1 : 1;
    const row = postId
      ? await tx.forumPost.update({ where: { id: postId }, data: { score: { increment: delta } }, select: { score: true } })
      : await tx.forumReply.update({ where: { id: replyId }, data: { score: { increment: delta } }, select: { score: true } });
    return { voted: !existing, score: row.score };
  });
  return { ok: true as const, ...result };
}

/** Post author accepts (or un-accepts with replyId=null) an answer. */
export async function acceptReply(postId: string, replyId: string | null) {
  const v = await getForumViewer();
  if (!v) return { ok: false as const };
  const post = await db.forumPost.findUnique({ where: { id: postId }, select: { id: true, title: true, authorId: true, acceptedReplyId: true } });
  if (!post || post.authorId !== v.id) return { ok: false as const };
  const reply = replyId
    ? await db.forumReply.findFirst({ where: { id: replyId, postId, status: "OPEN" }, select: { id: true, authorId: true } })
    : null;
  if (replyId && !reply) return { ok: false as const };
  await db.$transaction(async (tx) => {
    await tx.forumPost.update({ where: { id: postId }, data: { acceptedReplyId: reply?.id ?? null } });
    await setAcceptedRep(tx, { postId, postAuthorId: post.authorId, reply });
  });
  if (reply && reply.id !== post.acceptedReplyId) {
    await notify({
      userId: reply.authorId,
      actorId: v.id,
      type: "ANSWER_ACCEPTED",
      title: `Your answer was accepted on “${post.title}”`,
      body: "Nice work. Accepted answers earn reputation and help other students find the best explanation.",
      href: `${postHref(post)}#reply-${reply.id}`,
    });
  }
  revalidatePath(postHref(post));
  return { ok: true as const };
}

const reportSchema = z.object({
  postId: z.string().max(40).optional(),
  replyId: z.string().max(40).optional(),
  targetUserId: z.string().max(40).optional(),
  reason: z.enum(["spam", "harassment", "incorrect", "cheating", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export async function reportContent(raw: z.input<typeof reportSchema>) {
  const v = await getForumViewer();
  if (!v) return { ok: false as const, error: "Please sign in." };
  if (!v.canReport) return { ok: false as const, error: "Reporting unlocks at 15 reputation. If something is urgent, email us." };
  const d = reportSchema.parse(raw);
  if (await limited(v, "report")) return { ok: false as const, error: "You've sent a lot of reports recently." };
  const target = d.postId ? "POST" : d.replyId ? "REPLY" : "USER";
  await db.report.create({
    data: {
      reporterId: v.id,
      target,
      postId: d.postId ?? null,
      replyId: d.replyId ?? null,
      targetUserId: d.targetUserId ?? null,
      reason: d.reason,
      details: d.details ?? null,
    },
  });
  return { ok: true as const };
}

/** Server-side Markdown preview, so the preview matches exactly what will be published. */
export async function previewMarkdown(md: string) {
  const v = await getForumViewer();
  if (!v) return "";
  return userMarkdownToHtml(z.string().max(20_000).parse(md));
}

const uploadSchema = z.object({
  url: z.url().max(500),
  pathname: z.string().max(300),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  size: z.number().int().min(1).max(5 * 1024 * 1024),
});

/** Records an image the client just uploaded with a signed token from /api/uploads. */
export async function registerUpload(raw: z.input<typeof uploadSchema>) {
  const v = await getForumViewer();
  if (!v) return { ok: false as const };
  const d = uploadSchema.parse(raw);
  const u = new URL(d.url);
  if (!u.hostname.endsWith(".public.blob.vercel-storage.com") || !d.pathname.startsWith(`forum/${v.id}/`)) return { ok: false as const };
  await db.upload.create({ data: { ownerId: v.id, storageKey: d.pathname, contentType: d.contentType, sizeBytes: d.size } });
  return { ok: true as const };
}
