import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[560px] px-4 py-24 text-center">
      <p className="font-sans text-sm font-semibold uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Page not found</h1>
      <p className="mt-4 text-muted">That page doesn&apos;t exist, or it may have moved.</p>
      <Link href="/" className="btn btn-primary mt-8">
        Go to the book
      </Link>
    </main>
  );
}
