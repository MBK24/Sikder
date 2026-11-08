import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 pb-24 pt-10 sm:px-6">
      <h1 className="font-sans text-3xl font-bold tracking-tight">Account</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const user = await requireUser("/account");
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return <p className="mt-6">Profile not found.</p>;
  return (
    <>
      <p className="mt-2 text-muted">
        Signed in as <strong className="text-[var(--c-fg)]">{user.email}</strong>
        {user.emailVerified ? "" : " (email not yet confirmed)"}
      </p>
      <ProfileForm
        initial={{
          displayName: profile.displayName ?? "",
          username: profile.username,
          bio: profile.bio ?? "",
          targetTestDate: profile.targetTestDate ? profile.targetTestDate.toISOString().slice(0, 10) : "",
          targetScore: profile.targetScore ? String(profile.targetScore) : "",
          timezone: profile.timezone,
          emailOnReply: profile.emailOnReply,
          emailOnAccepted: profile.emailOnAccepted,
        }}
      />
      <section className="mt-12 border-t border-[var(--c-border)] pt-8">
        <h2 className="font-sans text-xl font-semibold">Community</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <Link className="text-[var(--c-accent)] underline" href={`/u/${profile.username}`}>
              View your public profile
            </Link>
          </li>
          <li>
            <Link className="text-[var(--c-accent)] underline" href="/account/verify">
              Apply to become a Verified Tutor or Expert
            </Link>
          </li>
        </ul>
      </section>
      <section className="mt-12 border-t border-[var(--c-border)] pt-8">
        <h2 className="font-sans text-xl font-semibold">Plan</h2>
        <p className="mt-2 text-muted">
          See your plan, renewal date, and invoices, or change plans, on the{" "}
          <Link href="/account/billing" className="text-[var(--c-accent)] underline">
            Billing
          </Link>{" "}
          page.
        </p>
      </section>
    </>
  );
}
