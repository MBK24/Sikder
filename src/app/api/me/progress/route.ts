import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

/** Completed chapters for the sidebar checkmarks, plus last-read position per chapter. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ completed: [], positions: {} }, { status: 401 });
  const rows = await db.chapterProgress.findMany({
    where: { userId: session.user.id },
    select: { completed: true, lastAnchor: true, maxScrollPct: true, chapter: { select: { slug: true, part: true } } },
  });
  return NextResponse.json(
    {
      completed: rows.filter((r) => r.completed).map((r) => `${ENUM_TO_CODE[r.chapter.part]}/${r.chapter.slug}`),
      positions: Object.fromEntries(
        rows.map((r) => [`${ENUM_TO_CODE[r.chapter.part]}/${r.chapter.slug}`, { anchor: r.lastAnchor, pct: r.maxScrollPct }]),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
