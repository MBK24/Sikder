import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { entitlementFor } from "@/server/entitlements";
import { grantVerifiedTutor, setUserBadge, setUserRole } from "@/server/actions/admin";
import { banUser, unbanUser } from "@/server/actions/moderation";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { RoleBadge } from "@/components/forum/AuthorChip";
import { TIERS } from "@/config/pricing";

export const metadata: Metadata = { title: "User", robots: { index: false } };

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-[var(--c-accent)]">
        ← Users
      </Link>
      <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      badges: { include: { badge: true } },
      subscriptions: { orderBy: { updatedAt: "desc" } },
      accounts: { select: { providerId: true } },
      _count: { select: { attempts: true, posts: true, replies: true, chapterProgress: { where: { completed: true } } } },
    },
  });
  if (!u) notFound();
  const [ent, allBadges] = await Promise.all([entitlementFor(u.id, u.role), db.badge.findMany({ orderBy: { label: "asc" } })]);
  const has = new Set(u.badges.map((b) => b.badgeId));
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{u.name || u.profile?.username}</h1>
        <RoleBadge role={u.role} />
        {u.banned ? <span className="badge !text-[var(--c-trap)]">banned{u.banExpires ? ` until ${u.banExpires.toLocaleDateString()}` : ""}</span> : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {u.email} {u.emailVerified ? "· verified" : "· email not verified"} · sign-in: {u.accounts.map((a) => a.providerId).join(", ") || "–"} · joined{" "}
        {u.createdAt.toLocaleDateString()}
        {u.profile ? (
          <>
            {" · "}
            <Link href={`/u/${u.profile.username}`} className="underline">
              @{u.profile.username}
            </Link>
          </>
        ) : null}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Access", TIERS[ent.tier].name + (ent.staff ? " (staff)" : "")],
          ["Questions answered", u._count.attempts],
          ["Chapters completed", u._count.chapterProgress],
          ["Forum posts", u._count.posts + u._count.replies],
          ["Reputation", u.profile?.reputation ?? 0],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-[var(--c-border)] p-3">
            <dt className="text-xs text-muted">{l}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--c-border)] p-5">
          <h2 className="font-semibold">Role</h2>
          <form action={setUserRole} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={u.id} />
            <select name="role" defaultValue={u.role} className="input max-w-[12rem]" aria-label="Role">
              {["STUDENT", "TUTOR", "EXPERT", "MODERATOR", "ADMIN"].map((r) => (
                <option key={r} value={r}>
                  {r.toLowerCase()}
                </option>
              ))}
            </select>
            <ConfirmButton message="Change this user's role? They'll be signed out so it applies immediately." className="btn btn-ghost">
              Change role
            </ConfirmButton>
          </form>
          {u.role === "STUDENT" ? (
            <form action={grantVerifiedTutor.bind(null, u.id)} className="mt-3">
              <button className="btn btn-primary !py-1.5 text-sm">Grant Verified Tutor (role + badge)</button>
            </form>
          ) : null}
          <h3 className="mt-5 text-sm font-semibold">Badges</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {allBadges.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span>
                  {b.label} <span className="text-xs text-muted">{b.description}</span>
                </span>
                <form action={setUserBadge}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="badgeId" value={b.id} />
                  <input type="hidden" name="grant" value={has.has(b.id) ? "0" : "1"} />
                  <button className="btn btn-ghost !px-2 !py-0.5 text-xs">{has.has(b.id) ? "Remove" : "Grant"}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--c-border)] p-5">
          <h2 className="font-semibold">Subscription</h2>
          {u.subscriptions.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {u.subscriptions.map((s) => (
                <li key={s.id} className="rounded-md bg-[var(--c-bg-subtle)] p-3">
                  <strong>{TIERS[s.tier].name}</strong> · {s.interval === "YEAR" ? "annual" : "monthly"} · {s.status.toLowerCase()}
                  <span className="block text-xs text-muted">
                    Period ends {s.currentPeriodEnd.toLocaleDateString()}
                    {s.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                    {s.trialEnd ? ` · trial until ${s.trialEnd.toLocaleDateString()}` : ""}
                    {s.pastDueSince ? ` · past due since ${s.pastDueSince.toLocaleDateString()}` : ""}
                  </span>
                  {s.id.startsWith("sub_") && !s.id.includes("demo") ? (
                    <a href={`https://dashboard.stripe.com/subscriptions/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--c-accent)] underline">
                      Open in Stripe
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No subscriptions (Free plan).</p>
          )}
          {u.stripeCustomerId ? <p className="mt-2 text-xs text-muted">Stripe customer: {u.stripeCustomerId}</p> : null}

          <h2 className="mt-6 font-semibold">Ban</h2>
          {u.banned ? (
            <form action={unbanUser.bind(null, u.id)} className="mt-2">
              <p className="text-sm">Reason: {u.banReason}</p>
              <button className="btn btn-ghost mt-2 text-sm">Lift ban</button>
            </form>
          ) : (
            <form action={banUser} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <label className="text-xs">
                Days (0 = permanent)
                <input name="days" type="number" min={0} max={3650} defaultValue={7} className="input !w-24" />
              </label>
              <label className="flex-1 text-xs">
                Reason
                <input name="reason" className="input" required minLength={3} maxLength={500} />
              </label>
              <ConfirmButton message="Ban this user? They'll be signed out." className="btn btn-ghost !text-[var(--c-trap)]">
                Ban
              </ConfirmButton>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
