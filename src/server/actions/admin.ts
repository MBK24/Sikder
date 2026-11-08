"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireRole, hasRole } from "@/server/auth";
import { CHAPTERS_TAG } from "@/server/content/book";
import type { Role } from "@/generated/prisma/enums";

const id = z.string().max(40);

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const chapterSchema = z.object({
  chapterId: id,
  access: z.enum(["FREE", "PREMIUM"]),
  status: z.enum(["DRAFT", "COMING_SOON", "PUBLISHED"]),
  earlyAccessUntil: z.string().optional(),
});

/** Free/paid, publish/unpublish, early-access window. Takes effect immediately (no redeploy). */
export async function updateChapter(form: FormData) {
  await requireRole("ADMIN");
  const d = chapterSchema.parse(Object.fromEntries(form));
  const early = d.earlyAccessUntil ? new Date(`${d.earlyAccessUntil}T23:59:59Z`) : null;
  const prev = await db.chapter.findUniqueOrThrow({ where: { id: d.chapterId }, select: { status: true, publishedAt: true } });
  await db.chapter.update({
    where: { id: d.chapterId },
    data: {
      access: d.access,
      status: d.status,
      earlyAccessUntil: early && !Number.isNaN(early.getTime()) ? early : null,
      ...(d.status === "PUBLISHED" && prev.status !== "PUBLISHED" && !prev.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });
  updateTag(CHAPTERS_TAG);
  revalidatePath("/admin/content");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const roleSchema = z.object({ userId: id, role: z.enum(["STUDENT", "TUTOR", "EXPERT", "MODERATOR", "ADMIN"]) });

export async function setUserRole(form: FormData) {
  const admin = await requireRole("ADMIN");
  const d = roleSchema.parse(Object.fromEntries(form));
  if (d.userId === admin.id && d.role !== "ADMIN") throw new Error("You can't remove your own admin role.");
  await db.$transaction([
    db.user.update({ where: { id: d.userId }, data: { role: d.role as Role } }),
    // Sessions carry the role; sign the user out so the change applies immediately.
    db.session.deleteMany({ where: { userId: d.userId } }),
    db.moderationAction.create({ data: { actorId: admin.id, type: "CHANGE_ROLE", targetUserId: d.userId, reason: `role → ${d.role}` } }),
  ]);
  revalidatePath(`/admin/users/${d.userId}`);
}

const badgeSchema = z.object({ userId: id, badgeId: id, grant: z.enum(["1", "0"]) });

export async function setUserBadge(form: FormData) {
  const admin = await requireRole("ADMIN");
  const d = badgeSchema.parse(Object.fromEntries(form));
  if (d.grant === "1") {
    await db.userBadge.upsert({
      where: { userId_badgeId: { userId: d.userId, badgeId: d.badgeId } },
      create: { userId: d.userId, badgeId: d.badgeId, grantedBy: admin.id },
      update: {},
    });
  } else {
    await db.userBadge.deleteMany({ where: { userId: d.userId, badgeId: d.badgeId } });
  }
  await db.moderationAction.create({
    data: { actorId: admin.id, type: d.grant === "1" ? "GRANT_BADGE" : "REVOKE_BADGE", targetUserId: d.userId, meta: { badgeId: d.badgeId } },
  });
  revalidatePath(`/admin/users/${d.userId}`);
}

/** Convenience: grant Verified Tutor in one click (role + badge). */
export async function grantVerifiedTutor(userId: string) {
  const admin = await requireRole("ADMIN");
  const user = await db.user.findUniqueOrThrow({ where: { id: id.parse(userId) }, select: { id: true, role: true } });
  if (!hasRole(user, "TUTOR")) {
    await db.user.update({ where: { id: user.id }, data: { role: "TUTOR" } });
    await db.session.deleteMany({ where: { userId: user.id } });
  }
  const badge = await db.badge.findUnique({ where: { slug: "verified-tutor" } });
  if (badge) {
    await db.userBadge.upsert({
      where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
      create: { userId: user.id, badgeId: badge.id, grantedBy: admin.id },
      update: {},
    });
  }
  await db.moderationAction.create({ data: { actorId: admin.id, type: "CHANGE_ROLE", targetUserId: user.id, reason: "granted Verified Tutor" } });
  revalidatePath(`/admin/users/${user.id}`);
}
