import Link from "next/link";

const LINKS = [
  ["/admin/moderation", "Moderation"],
  ["/admin/verifications", "Verifications"],
  ["/admin/settings", "Settings"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 font-sans sm:px-6">
      <nav aria-label="Admin" className="mb-6 flex flex-wrap items-center gap-1 border-b border-[var(--c-border)] pb-3 text-sm">
        <span className="mr-3 font-bold">Admin</span>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="rounded px-2.5 py-1 text-muted hover:bg-[var(--c-bg-subtle)] hover:text-[var(--c-fg)]">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
