"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";

const schema = z.object({
  displayName: z.string().trim().max(60).optional().transform((v) => v || null),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Usernames are 3–24 characters: letters, numbers, underscores."),
  bio: z.string().trim().max(1000).optional().transform((v) => v || null),
  targetTestDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))
    .refine((d) => !d || !Number.isNaN(d.getTime()), "Invalid date"),
  targetScore: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((n) => n === null || (Number.isInteger(n) && n >= 472 && n <= 528), "Target score must be between 472 and 528."),
  timezone: z.string().max(64).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  emailOnReply: z.literal("on").optional(),
  emailOnAccepted: z.literal("on").optional(),
});

export type ProfileFormState = { ok?: boolean; error?: string };

export async function updateProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { emailOnReply, emailOnAccepted, ...data } = parsed.data;
  const taken = await db.profile.findFirst({
    where: { username: data.username, NOT: { userId: session.user.id } },
    select: { userId: true },
  });
  if (taken) return { error: "That username is taken." };
  await db.profile.update({
    where: { userId: session.user.id },
    data: { ...data, emailOnReply: !!emailOnReply, emailOnAccepted: !!emailOnAccepted },
  });
  revalidatePath("/account");
  return { ok: true };
}
