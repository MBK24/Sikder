"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireRole, hasRole } from "@/server/auth";
import { notify } from "@/server/notifications";
import { postHref } from "@/server/forum";
import type { ForumPostStatus, ModerationActionType } from "@/generated/prisma/enums";

const id = z.string().max(40);
const reason = z.string().trim().max(500).optional();

const POST_ACTION: Record<string, { status: ForumPostStatus; type: ModerationActionType }> = {
  hide: { status: "HIDDEN", type: "HIDE_POST" },
  unhide: { status: "OPEN", type: "UNHIDE_POST" },
  lock: { status: "LOCKED", type: "LOCK_POST" },
  unlock: { status: "OPEN", type: "UNLOCK_POST" },
};

export async function moderatePost(postId: string, action: "hide" | "unhide" | "lock" | "unlock", why?: string) {
  const mod = await requireRole("MODERATOR");
  const a = POST_ACTION[action];
  const post = await db.forumPost.update({ where: { id: id.parse(postId) }, data: { status: a.status }, select: { id: true, title: true, authorId: true } });
  await db.moderationAction.create({ data: { actorId: mod.id, type: a.type, postId: post.id, targetUserId: post.authorId, reason: reason.parse(why) ?? null } });
  if (action === "hide" || action === "lock") {
    await notify({
      userId: post.authorId,
      actorId: mod.id,
      type: "MODERATION",
      title: action === "hide" ? `Your question “${post.title}” was hidden by a moderator` : `Your question “${post.title}” was locked`,
      body: why ? `Reason: ${why}` : "If you think this was a mistake, reply to this email.",
      href: postHref(post),
    });
  }
  revalidatePath(postHref(post));
  revalidatePath("/admin/moderation");
}

export async function moderateReply(replyId: string, action: "hide" | "unhide", why?: string) {
  const mod = await requireRole("MODERATOR");
  const reply = await db.forumReply.update({
    where: { id: id.parse(replyId) },
    data: { status: action === "hide" ? "HIDDEN" : "OPEN" },
    select: { id: true, authorId: true, postId: true, post: { select: { id: true, title: true, acceptedReplyId: true } } },
  });
  await db.moderationAction.create({
    data: { actorId: mod.id, type: action === "hide" ? "HIDE_REPLY" : "UNHIDE_REPLY", replyId: reply.id, postId: reply.postId, targetUserId: reply.authorId, reason: reason.parse(why) ?? null },
  });
  // Keep counters honest: hidden replies don't count.
  await db.forumPost.update({ where: { id: reply.postId }, data: { replyCount: { increment: action === "hide" ? -1 : 1 } } });
  if (action === "hide") {
    await notify({ userId: reply.authorId, actorId: mod.id, type: "MODERATION", title: `One of your answers was hidden by a moderator`, body: why ? `Reason: ${why}` : undefined, href: postHref(reply.post) });
  }
  revalidatePath(postHref(reply.post));
  revalidatePath("/admin/moderation");
}

export async function resolveReport(reportId: string, status: "RESOLVED" | "DISMISSED", resolution?: string) {
  const mod = await requireRole("MODERATOR");
  await db.report.update({
    where: { id: id.parse(reportId) },
    data: { status, resolvedById: mod.id, resolvedAt: new Date(), resolution: reason.parse(resolution) ?? null },
  });
  await db.moderationAction.create({ data: { actorId: mod.id, type: "RESOLVE_REPORT", reason: `${status.toLowerCase()}${resolution ? `: ${resolution}` : ""}` } });
  revalidatePath("/admin/moderation");
}

const banSchema = z.object({ userId: id, days: z.coerce.number().int().min(0).max(3650), reason: z.string().trim().min(3).max(500) });

/** Moderators can ban students; only admins can ban staff. 0 days = permanent. Active sessions are revoked. */
export async function banUser(form: FormData) {
  const mod = await requireRole("MODERATOR");
  const d = banSchema.parse(Object.fromEntries(form));
  const target = await db.user.findUniqueOrThrow({ where: { id: d.userId }, select: { id: true, role: true } });
  if (target.id === mod.id) throw new Error("You can't ban yourself.");
  if (hasRole(target, "TUTOR") && !hasRole(mod, "ADMIN")) throw new Error("Only admins can ban staff.");
  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: { banned: true, banReason: d.reason, banExpires: d.days ? new Date(Date.now() + d.days * 86_400_000) : null },
    }),
    db.session.deleteMany({ where: { userId: target.id } }),
    db.moderationAction.create({ data: { actorId: mod.id, type: "BAN_USER", targetUserId: target.id, reason: d.reason, meta: { days: d.days } } }),
  ]);
  revalidatePath("/admin/moderation");
}

export async function unbanUser(userId: string) {
  const mod = await requireRole("MODERATOR");
  await db.user.update({ where: { id: id.parse(userId) }, data: { banned: false, banReason: null, banExpires: null } });
  await db.moderationAction.create({ data: { actorId: mod.id, type: "UNBAN_USER", targetUserId: userId } });
  revalidatePath("/admin/moderation");
}
