"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { PART_ENUM, type PartCode } from "@/lib/content/schema";

const input = z.object({ part: z.string().max(40), slug: z.string().max(120), completed: z.boolean() });

export async function setChapterComplete(raw: z.input<typeof input>) {
  const { part, slug, completed } = input.parse(raw);
  const session = await getSession();
  if (!session) return { ok: false as const, reason: "signed-out" as const };
  const chapter = await db.chapter.findUnique({ where: { slug }, select: { id: true, part: true } });
  if (!chapter || chapter.part !== PART_ENUM[part as PartCode]) {
    return { ok: false as const, reason: "not-found" as const };
  }
  const userId = session.user.id;
  await db.chapterProgress.upsert({
    where: { userId_chapterId: { userId, chapterId: chapter.id } },
    create: { userId, chapterId: chapter.id, completed, completedAt: completed ? new Date() : null, maxScrollPct: completed ? 1 : 0 },
    update: { completed, completedAt: completed ? new Date() : null, lastVisitedAt: new Date() },
  });
  return { ok: true as const };
}
