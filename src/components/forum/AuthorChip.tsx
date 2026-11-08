import Link from "next/link";
import clsx from "clsx";
import type { Role } from "@/generated/prisma/enums";

export interface ChipAuthor {
  name: string | null;
  role: Role;
  profile: { username: string; displayName: string | null; reputation: number } | null;
  badges: { badge: { slug: string; label: string; color: string } }[];
}

const ROLE_BADGE: Partial<Record<Role, { label: string; cls: string; title: string }>> = {
  TUTOR: { label: "Verified Tutor", cls: "role-tutor", title: "Vetted by our team" },
  EXPERT: { label: "Expert", cls: "role-expert", title: "MD/PhD, faculty, or content author" },
  MODERATOR: { label: "Moderator", cls: "role-mod", title: "Community moderator" },
  ADMIN: { label: "Admin", cls: "role-mod", title: "Site administrator" },
};

export function RoleBadge({ role }: { role: Role }) {
  const b = ROLE_BADGE[role];
  if (!b) return null;
  return (
    <span className={clsx("role-badge", b.cls)} title={b.title}>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden fill="currentColor">
        <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3z" />
        <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="var(--c-bg)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {b.label}
    </span>
  );
}

export function AuthorChip({ author, showBadges = true, size = "sm" }: { author: ChipAuthor; showBadges?: boolean; size?: "sm" | "md" }) {
  const name = author.profile?.displayName || author.name || author.profile?.username || "Former member";
  const extra = author.badges.filter((b) => !["verified-tutor", "expert", "moderator"].includes(b.badge.slug)).slice(0, 2);
  return (
    <span className={clsx("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1", size === "md" ? "text-sm" : "text-xs")}>
      {author.profile ? (
        <Link href={`/u/${author.profile.username}`} className="font-semibold hover:text-[var(--c-accent)]">
          {name}
        </Link>
      ) : (
        <span className="font-semibold">{name}</span>
      )}
      <RoleBadge role={author.role} />
      {showBadges ? extra.map((b) => <span key={b.badge.slug} className="badge !py-0 !text-[0.65rem]">{b.badge.label}</span>) : null}
      {author.profile ? (
        <span className="text-muted tabular-nums" title="Reputation">
          {author.profile.reputation.toLocaleString()} rep
        </span>
      ) : null}
    </span>
  );
}
