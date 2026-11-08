import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

/** Most recently visited, not-yet-completed chapter. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null, { status: 401 });
  const row = await db.chapterProgress.findFirst({
    where: { userId: session.user.id, completed: false },
    orderBy: { lastVisitedAt: "desc" },
    select: { lastAnchor: true, maxScrollPct: true, chapter: { select: { slug: true, part: true, title: true } } },
  });
  if (!row) return NextResponse.json(null, { headers: { "Cache-Control": "private, no-store" } });
  const href = `/${ENUM_TO_CODE[row.chapter.part]}/${row.chapter.slug}${row.lastAnchor ? `#${row.lastAnchor}` : ""}`;
  return NextResponse.json(
    { href, title: row.chapter.title, pct: row.maxScrollPct },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
