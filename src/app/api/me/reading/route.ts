import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { bumpStudyDay } from "@/server/study-day";

const body = z.object({
  part: z.string().max(40),
  slug: z.string().max(120),
  maxScrollPct: z.number().min(0).max(1),
  lastAnchor: z.string().max(200).nullable(),
  seconds: z.number().int().min(0).max(600), // at most one 30s window + slack; rejects inflated values
});

/** Receives sendBeacon pings from <ReadingProgress>. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { slug, maxScrollPct, lastAnchor, seconds } = parsed.data;
  const chapter = await db.chapter.findUnique({ where: { slug }, select: { id: true } });
  if (!chapter) return new NextResponse(null, { status: 204 });
  const userId = session.user.id;
  const existing = await db.chapterProgress.findUnique({
    where: { userId_chapterId: { userId, chapterId: chapter.id } },
    select: { maxScrollPct: true },
  });
  await db.chapterProgress.upsert({
    where: { userId_chapterId: { userId, chapterId: chapter.id } },
    create: { userId, chapterId: chapter.id, maxScrollPct, lastAnchor, secondsReading: seconds },
    update: {
      maxScrollPct: Math.max(existing?.maxScrollPct ?? 0, maxScrollPct),
      lastAnchor: lastAnchor ?? undefined,
      secondsReading: { increment: seconds },
      lastVisitedAt: new Date(),
    },
  });
  if (seconds > 0) await bumpStudyDay(userId, { secondsReading: seconds });
  return new NextResponse(null, { status: 204 });
}
