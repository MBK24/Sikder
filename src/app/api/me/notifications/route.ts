import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";

/** Unread count for the header bell. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ unread: 0 }, { status: 401 });
  const unread = await db.notification.count({ where: { userId: s.user.id, readAt: null } });
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });
}
