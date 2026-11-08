import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { siteConfig } from "@/config/site";
import type { NotificationType } from "@/generated/prisma/enums";

/** Which profile preference gates the email for each notification type (null = always in-app only). */
const EMAIL_PREF: Partial<Record<NotificationType, "emailOnReply" | "emailOnAccepted" | "emailOnTutoring">> = {
  REPLY_TO_POST: "emailOnReply",
  ANSWER_ACCEPTED: "emailOnAccepted",
  TUTORING_REQUEST: "emailOnTutoring",
  TUTORING_MESSAGE: "emailOnTutoring",
  TUTORING_STATUS: "emailOnTutoring",
};
const ALWAYS_EMAIL: NotificationType[] = ["VERIFICATION_DECISION", "MODERATION"];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  /** Skip if the recipient is the actor (e.g. replying to your own post). */
  actorId?: string;
}

/** Creates an in-app notification and, if the user's preferences allow, sends an email. Never throws. */
export async function notify(n: NotifyInput) {
  if (n.actorId && n.actorId === n.userId) return;
  try {
    const user = await db.user.findUnique({
      where: { id: n.userId },
      select: { email: true, emailVerified: true, banned: true, profile: true },
    });
    if (!user || user.banned) return;
    const pref = EMAIL_PREF[n.type];
    const wantsEmail = user.emailVerified && (ALWAYS_EMAIL.includes(n.type) || (pref ? user.profile?.[pref] !== false : false));
    const row = await db.notification.create({
      data: { userId: n.userId, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null },
    });
    if (wantsEmail) {
      await sendEmail({
        to: user.email,
        subject: n.title,
        text: `${n.body ?? ""}\n\nYou can change which emails you get in your account settings: ${siteConfig.url}/account`.trim(),
        action: n.href ? { label: "Open", url: `${siteConfig.url}${n.href}` } : undefined,
      });
      await db.notification.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
}
