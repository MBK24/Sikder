import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <Suspense>
      <SignInForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
