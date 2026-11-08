import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Email confirmed", robots: { index: false } };

export default function Page() {
  return (
    <div>
      <h1 className="mb-3 font-serif text-3xl font-semibold">Email confirmed</h1>
      <p className="text-muted">Thanks! Your address is verified, so you can post in the forum and get notifications.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to the book
      </Link>
    </div>
  );
}
