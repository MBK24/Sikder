"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession, hasRole } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { tutoringQuota } from "@/server/tutoring";
import { notify } from "@/server/notifications";
import { rateLimit } from "@/server/ratelimit";
import { FORUM_LIMITS } from "@/config/reputation";

export type TutoringFormState = { error?: string; ok?: boolean };

const requestSchema = z.object({
  tutorId: z.string().max(40),
  part: z.enum(["CP", "CARS", "BB", "PS", ""]).optional(),
  topic: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20, "Tell the tutor a little more (at least 20 characters).").max(3000),
  times: z.string().trim().min(3, "Suggest at least one time that works for you.").max(500),
});

export async function requestTutoring(_prev: TutoringFormState, form: FormData): Promise<TutoringFormState> {
  const s = await getSession();
  if (!s) return { error: "Please sign in." };
  const ent = await getEntitlement();
  if (!can(ent, "tutoring.request")) return { error: "Tutoring requests are part of Premium + Tutoring." };
  const parsed = requestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const tutor = await db.user.findUnique({ where: { id: d.tutorId }, select: { id: true, role: true, banned: true, profile: { select: { acceptingRequests: true } } } });
  if (!tutor || tutor.banned || !hasRole(tutor, "TUTOR") || !tutor.profile?.acceptingRequests) return { error: "This tutor isn't taking requests right now." };
  if (tutor.id === s.user.id) return { error: "You can't request a session with yourself." };
  const quota = await tutoringQuota(s.user.id, ent);
  if (!quota.remaining) return { error: `You've used your ${quota.limit} session requests for this month. They reset on your next billing date.` };

  const req = await db.tutoringRequest.create({
    data: {
      studentId: s.user.id,
      tutorId: tutor.id,
      part: d.part || null,
      topic: d.topic,
      message: d.message,
      proposedTimes: { text: d.times },
      quotaPeriodStart: quota.periodStart,
    },
    select: { id: true },
  });
  await notify({
    userId: tutor.id,
    actorId: s.user.id,
    type: "TUTORING_REQUEST",
    title: `New tutoring request: ${d.topic}`,
    body: d.message.slice(0, 280),
    href: `/tutoring/${req.id}`,
  });
  redirect(`/tutoring/${req.id}`);
}

async function loadForParticipant(requestId: string) {
  const s = await getSession();
  if (!s) throw new Error("Please sign in.");
  const req = await db.tutoringRequest.findUnique({ where: { id: z.string().max(40).parse(requestId) } });
  if (!req || (req.studentId !== s.user.id && req.tutorId !== s.user.id)) throw new Error("Not found");
  return { req, userId: s.user.id, isTutor: req.tutorId === s.user.id };
}

const statusSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED", "SCHEDULED", "COMPLETED", "CANCELED"]),
  scheduledFor: z.string().optional(),
  durationMin: z.coerce.number().int().min(15).max(240).optional(),
  meetingLink: z.url().max(500).optional().or(z.literal("")),
  /** Browser's getTimezoneOffset() (minutes), so a local "7:00 PM" is stored as the right instant. */
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
});

/** Allowed transitions: tutor accepts/declines/schedules/completes; student cancels. */
export async function updateTutoringStatus(requestId: string, _prev: TutoringFormState, form: FormData): Promise<TutoringFormState> {
  const { req, userId, isTutor } = await loadForParticipant(requestId);
  const parsed = statusSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;
  const tutorMoves = ["ACCEPTED", "DECLINED", "SCHEDULED", "COMPLETED"];
  if (isTutor ? !tutorMoves.includes(d.status) : d.status !== "CANCELED") return { error: "You can't make that change." };
  if (["DECLINED", "CANCELED", "COMPLETED"].includes(req.status)) return { error: "This request is closed." };
  let scheduledFor: Date | null = req.scheduledFor;
  if (d.status === "SCHEDULED") {
    if (!d.scheduledFor) return { error: "Pick a date and time." };
    // datetime-local has no zone: treat it as UTC, then shift by the browser's offset.
    const asUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.scheduledFor) ? `${d.scheduledFor}:00Z` : `${d.scheduledFor}Z`;
    scheduledFor = new Date(new Date(asUtc).getTime() + d.tzOffset * 60_000);
    if (Number.isNaN(scheduledFor.getTime())) return { error: "Pick a valid date and time." };
  }
  await db.tutoringRequest.update({
    where: { id: req.id },
    data: {
      status: d.status,
      scheduledFor,
      ...(d.durationMin ? { durationMin: d.durationMin } : {}),
      ...(d.meetingLink !== undefined ? { meetingLink: d.meetingLink || null } : {}),
    },
  });
  const words: Record<string, string> = {
    ACCEPTED: "accepted your tutoring request",
    DECLINED: "declined your tutoring request",
    SCHEDULED: "scheduled your session",
    COMPLETED: "marked your session as completed",
    CANCELED: "canceled their tutoring request",
  };
  await notify({
    userId: isTutor ? req.studentId : req.tutorId,
    actorId: userId,
    type: "TUTORING_STATUS",
    title: `Your tutor ${words[d.status]}`.replace("Your tutor canceled", "A student canceled"),
    href: `/tutoring/${req.id}`,
  });
  revalidatePath(`/tutoring/${req.id}`);
  return { ok: true };
}

export async function sendTutoringMessage(requestId: string, _prev: TutoringFormState, form: FormData): Promise<TutoringFormState> {
  const { req, userId, isTutor } = await loadForParticipant(requestId);
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };
  if (["DECLINED", "CANCELED"].includes(req.status)) return { error: "This request is closed." };
  const l = FORUM_LIMITS.tutoringMessage;
  if (!(await rateLimit(`tutoring:msg:${userId}`, l.max, l.windowSec))) return { error: "You're sending messages very quickly." };
  await db.tutoringMessage.create({ data: { requestId: req.id, senderId: userId, body: body.data } });
  await db.tutoringRequest.update({ where: { id: req.id }, data: { updatedAt: new Date() } });
  await notify({
    userId: isTutor ? req.studentId : req.tutorId,
    actorId: userId,
    type: "TUTORING_MESSAGE",
    title: `New message about “${req.topic}”`,
    body: body.data.slice(0, 280),
    href: `/tutoring/${req.id}`,
  });
  revalidatePath(`/tutoring/${req.id}`);
  return { ok: true };
}

const tutorProfileSchema = z.object({
  tutorHeadline: z.string().trim().max(140).optional(),
  tutorAvailability: z.string().trim().max(500).optional(),
  acceptingRequests: z.literal("on").optional(),
  tutorSubjects: z.array(z.enum(["CP", "CARS", "BB", "PS"])).default([]),
});

export async function updateTutorProfile(_prev: TutoringFormState, form: FormData): Promise<TutoringFormState> {
  const s = await getSession();
  if (!s || !hasRole(s.user, "TUTOR")) return { error: "Only verified tutors can do that." };
  const d = tutorProfileSchema.parse({ ...Object.fromEntries(form), tutorSubjects: form.getAll("tutorSubjects") });
  await db.profile.update({
    where: { userId: s.user.id },
    data: {
      tutorHeadline: d.tutorHeadline || null,
      tutorAvailability: d.tutorAvailability || null,
      acceptingRequests: d.acceptingRequests === "on",
      tutorSubjects: d.tutorSubjects,
    },
  });
  revalidatePath("/tutor");
  return { ok: true };
}
