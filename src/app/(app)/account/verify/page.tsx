import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser, hasRole } from "@/server/auth";
import { db } from "@/server/db";
import { VerifyForm } from "@/components/admin/VerifyForm";

export const metadata: Metadata = { title: "Become a verified tutor", robots: { index: false } };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Become a verified tutor or expert</h1>
      <p className="mt-2 font-serif text-lg text-muted">
        Verified members get a badge, their answers appear first and highlighted, and tutors can receive 1:1 session requests. We
        review every application by hand: typically a 515+ score or professional tutoring experience for tutors, and an MD/PhD or
        faculty role for experts.
      </p>
      <Suspense fallback={null}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  const user = await requireUser("/account/verify");
  if (hasRole(user, "TUTOR")) {
    return (
      <p className="mt-6 rounded-lg border border-[var(--c-ok)] bg-[var(--c-ok-bg)] p-4">
        You&apos;re already verified. Head to your{" "}
        <Link href="/tutor" className="font-semibold underline">
          tutor workspace
        </Link>
        .
      </p>
    );
  }
  const last = await db.verificationRequest.findFirst({ where: { applicantId: user.id }, orderBy: { createdAt: "desc" } });
  if (last?.status === "PENDING") return <p className="mt-6 rounded-lg border border-[var(--c-border)] p-4">Your application is under review. We&apos;ll email you with the decision.</p>;
  return (
    <div className="mt-8">
      {last?.status === "REJECTED" ? (
        <p className="mb-4 rounded-md bg-[var(--c-bg-subtle)] p-3 text-sm">
          Your previous application wasn&apos;t approved{last.reviewNote ? `: ${last.reviewNote}` : "."} You&apos;re welcome to apply again.
        </p>
      ) : null}
      <VerifyForm />
    </div>
  );
}
