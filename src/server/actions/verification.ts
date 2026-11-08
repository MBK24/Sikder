"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession, requireRole, hasRole } from "@/server/auth";
import { notify } from "@/server/notifications";
import type { Role } from "@/generated/prisma/enums";

export type VerifyFormState = { error?: string; ok?: boolean };

const applySchema = z.object({
  kind: z.enum(["TUTOR", "EXPERT"]),
  credential: z.string().trim().min(5).max(300),
  score: z.coerce.number().int().min(472).max(528).optional(),
  experience: z.string().trim().min(30, "Tell us a bit more about your background (at least 30 characters).").max(3000),
  link: z.url().max(500).optional().or(z.literal("")),
});

export async function applyForVerification(_prev: VerifyFormState, form: FormData): Promise<VerifyFormState> {
  const s = await getSession();
  if (!s) return { error: "Please sign in." };
  if (!s.user.emailVerified) return { error: "Please confirm your email address first." };
  const parsed = applySchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const pending = await db.verificationRequest.findFirst({ where: { applicantId: s.user.id, status: "PENDING" } });
  if (pending) return { error: "You already have an application under review." };
  const { kind, ...details } = parsed.data;
  await db.verificationRequest.create({ data: { applicantId: s.user.id, kind, details } });
  revalidatePath("/account/verify");
  return { ok: true };
}

const reviewSchema = z.object({ requestId: z.string().max(40), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(1000).optional() });

/** Admin approves (grants role + badge) or rejects a verification application. */
export async function reviewVerification(form: FormData) {
  const admin = await requireRole("ADMIN");
  const d = reviewSchema.parse(Object.fromEntries(form));
  const req = await db.verificationRequest.findUniqueOrThrow({ where: { id: d.requestId }, include: { applicant: { select: { id: true, role: true } } } });
  if (req.status !== "PENDING") return;
  await db.verificationRequest.update({ where: { id: req.id }, data: { status: d.decision, reviewerId: admin.id, reviewNote: d.note ?? null, reviewedAt: new Date() } });
  if (d.decision === "APPROVED") {
    const newRole: Role = req.kind === "EXPERT" ? "EXPERT" : "TUTOR";
    // Never downgrade someone who already holds a higher role.
    if (!hasRole(req.applicant, newRole)) {
      await db.user.update({ where: { id: req.applicant.id }, data: { role: newRole } });
      await db.session.deleteMany({ where: { userId: req.applicant.id } }).catch(() => {});
    }
    const badge = await db.badge.findUnique({ where: { slug: req.kind === "EXPERT" ? "expert" : "verified-tutor" } });
    if (badge) {
      await db.userBadge.upsert({
        where: { userId_badgeId: { userId: req.applicant.id, badgeId: badge.id } },
        create: { userId: req.applicant.id, badgeId: badge.id, grantedBy: admin.id },
        update: {},
      });
    }
    await db.moderationAction.create({ data: { actorId: admin.id, type: "CHANGE_ROLE", targetUserId: req.applicant.id, reason: `verified ${req.kind.toLowerCase()}` } });
  }
  await notify({
    userId: req.applicant.id,
    type: "VERIFICATION_DECISION",
    title: d.decision === "APPROVED" ? `You're now a verified ${req.kind === "EXPERT" ? "Expert" : "Tutor"}` : "Update on your verification application",
    body:
      d.decision === "APPROVED"
        ? "Your answers will now show a verified badge and appear above other answers. Sign in again to see your new tools."
        : `We weren't able to verify your application this time.${d.note ? ` Note from our team: ${d.note}` : ""}`,
    href: d.decision === "APPROVED" ? "/tutor" : "/account/verify",
  });
  revalidatePath("/admin/verifications");
}
