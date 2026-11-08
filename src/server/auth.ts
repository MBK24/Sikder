import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { sendEmail } from "./email";
import { siteConfig } from "@/config/site";
import type { Role } from "@/generated/prisma/enums";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

async function uniqueUsername(email: string, name?: string | null) {
  const base =
    (name || email.split("@")[0])
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "student";
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const taken = await db.profile.findUnique({ where: { username: candidate }, select: { userId: true } });
    if (!taken) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${base}${Date.now().toString(36)}`;
}

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: process.env.BETTER_AUTH_URL ?? siteConfig.url,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-minute signed cache; role/ban changes apply within 5 min
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: false, // users can read immediately; posting requires verification (checked in forum actions)
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Reset your ${siteConfig.name} password`,
        text: "Someone (hopefully you) asked to reset your password. The link below expires in one hour. If you didn't ask, you can ignore this email.",
        action: { label: "Choose a new password", url },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Confirm your email for ${siteConfig.name}`,
        text: `Welcome! Confirm your email address to post in the forum and receive notifications.`,
        action: { label: "Confirm email", url },
      });
    },
  },
  socialProviders: googleEnabled
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : {},
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  rateLimit: {
    // On in production; off in local dev. AUTH_RATE_LIMIT=1/0 overrides (e.g. =0 for end-to-end test runs).
    enabled: process.env.AUTH_RATE_LIMIT ? process.env.AUTH_RATE_LIMIT === "1" : process.env.NODE_ENV === "production",
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/send-verification-email": { window: 60 * 10, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const role: Role = adminEmails.includes(user.email.toLowerCase()) ? "ADMIN" : "STUDENT";
          return { data: { ...user, role } };
        },
        after: async (user) => {
          await db.profile.create({
            data: { userId: user.id, username: await uniqueUsername(user.email, user.name), displayName: user.name || null },
          });
          await sendEmail({
            to: user.email,
            subject: `Welcome to ${siteConfig.name}`,
            text:
              `Thanks for joining. A good first step is the Getting Started part of the book, which explains how the MCAT is scored and how to build a study plan.\n\n` +
              `Every chapter has practice questions built in, and your progress is saved as you go.`,
            action: { label: "Start reading", url: `${siteConfig.url}/getting-started/how-the-mcat-is-scored` },
          });
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: "STUDENT", adminRoles: ["ADMIN"] }),
    nextCookies(), // must be last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
export type SessionUser = AuthSession["user"] & { role: Role };

/** Current session for this request (deduped per render). */
export const getSession = cache(async (): Promise<{ user: SessionUser; session: AuthSession["session"] } | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return { ...s, user: { ...s.user, role: (s.user.role ?? "STUDENT") as Role } };
});

export async function requireUser(returnTo?: string) {
  const s = await getSession();
  if (!s) redirect(`/sign-in${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  return s.user;
}

const ROLE_RANK: Record<Role, number> = { STUDENT: 0, TUTOR: 1, EXPERT: 2, MODERATOR: 3, ADMIN: 4 };

export function hasRole(user: { role: Role } | null | undefined, min: Role) {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[min];
}

export async function requireRole(min: Role) {
  const user = await requireUser();
  if (!hasRole(user, min)) redirect("/");
  return user;
}
