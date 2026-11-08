import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function Page() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <Suspense>
      <SignUpForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
