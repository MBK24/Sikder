"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient, signIn, signUp } from "@/lib/auth-client";

/** Only allow same-site relative redirects (prevents open-redirects via ?next=). */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input className="input" {...props} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-[var(--c-trap)] bg-[var(--c-trap-bg)] px-3 py-2 text-sm text-[var(--c-trap)]">
      {children}
    </p>
  );
}

function GoogleButton({ next }: { next: string }) {
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={() => signIn.social({ provider: "google", callbackURL: next })}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 01-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0012 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 010-4.2V7H2.1a11 11 0 000 10l3.7-2.9z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 002.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-[var(--c-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--c-border)]" />
      </div>
    </>
  );
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: true,
    });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Incorrect email or password.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Sign in</h1>
      {googleEnabled ? <GoogleButton next={next} /> : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-[var(--c-accent)] underline-offset-2 hover:underline">
          Forgot password?
        </Link>
        <Link href={`/sign-up${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-[var(--c-accent)] underline-offset-2 hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Use at least 10 characters for your password.");
    setPending(true);
    setError(null);
    const { error } = await signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password,
      callbackURL: next,
    });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with that email already exists. Try signing in."
            : (error.message ?? "Something went wrong. Please try again."),
      );
      return;
    }
    router.push(next === "/" ? "/getting-started/how-to-use-this-site" : next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Create your free account</h1>
      <p className="mb-6 mt-2 text-sm text-muted">Save your progress, answers, and flashcards. No credit card needed.</p>
      {googleEnabled ? <GoogleButton next={next} /> : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" name="name" autoComplete="name" required maxLength={80} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--c-accent)] underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(new FormData(e.currentTarget).get("email")),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error?.status === 429) return setError("Too many requests. Please wait a few minutes.");
    // Always show success so the form can't be used to discover which emails have accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="mb-3 font-serif text-3xl font-semibold">Check your email</h1>
        <p className="text-muted">If an account exists for that address, we&apos;ve sent a link to reset your password. It expires in one hour.</p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();
  const [error, setError] = useState<string | null>(params.get("error") ? "This reset link is invalid or has expired." : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) return setError("The passwords don't match.");
    if (!token) return setError("This reset link is invalid or has expired.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (error) return setError(error.message ?? "This reset link is invalid or has expired.");
    router.push("/sign-in");
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending || !token}>
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
