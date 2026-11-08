"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth";

/** Admin toggle: whether Stripe Checkout shows the promotion-code field. */
export async function setPromotionCodes(form: FormData) {
  const admin = await requireRole("ADMIN");
  const enabled = form.get("enabled") === "on";
  await db.appSetting.upsert({
    where: { key: "checkout.allowPromotionCodes" },
    create: { key: "checkout.allowPromotionCodes", value: enabled, updatedBy: admin.id },
    update: { value: enabled, updatedBy: admin.id },
  });
  revalidatePath("/admin/settings");
}
