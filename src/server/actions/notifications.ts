"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";

export async function markAllRead() {
  const s = await getSession();
  if (!s) return;
  await db.notification.updateMany({ where: { userId: s.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}
