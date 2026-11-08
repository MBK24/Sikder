import "server-only";
import { db } from "./db";
import type { Entitlement } from "./entitlements";
import { TUTORING_REQUESTS_PER_PERIOD } from "@/config/pricing";
import { quotaPeriodStart as periodStart } from "@/lib/periods";

export const quotaPeriodStart = (ent: Entitlement, now = new Date()) => periodStart(ent.currentPeriodStart, now);

export async function tutoringQuota(userId: string, ent: Entitlement) {
  const periodStart = quotaPeriodStart(ent);
  const used = await db.tutoringRequest.count({
    where: { studentId: userId, quotaPeriodStart: { gte: periodStart }, status: { notIn: ["DECLINED", "CANCELED"] } },
  });
  return { used, limit: TUTORING_REQUESTS_PER_PERIOD, periodStart, remaining: Math.max(0, TUTORING_REQUESTS_PER_PERIOD - used) };
}
