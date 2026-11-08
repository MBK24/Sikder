import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { RoleBadge } from "@/components/forum/AuthorChip";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Users", robots: { index: false } };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function UsersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: SP }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { profile: { username: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(role ? { role: role as "STUDENT" } : {}),
  };
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      banned: true,
      createdAt: true,
      profile: { select: { username: true, reputation: true } },
      subscriptions: { where: { status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } }, select: { tier: true, status: true }, take: 1 },
    },
  });
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      <form className="mt-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Email, name, or username" className="input max-w-xs" aria-label="Search users" />
        <select name="role" defaultValue={role} className="input max-w-[12rem]" aria-label="Role">
          <option value="">All roles</option>
          {["STUDENT", "TUTOR", "EXPERT", "MODERATOR", "ADMIN"].map((r) => (
            <option key={r} value={r}>
              {r.toLowerCase()}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost">Search</button>
      </form>
      <div className="table-wrap">
        <table className="viz-table min-w-[720px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Plan</th>
              <th className="num">Rep</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-[var(--c-accent)]">
                    {u.name || u.profile?.username}
                  </Link>
                  <span className="block text-xs text-muted">{u.email}</span>
                </td>
                <td>
                  {u.role === "STUDENT" ? <span className="text-muted">student</span> : <RoleBadge role={u.role} />}
                  {u.banned ? <span className="badge ml-1 !text-[var(--c-trap)]">banned</span> : null}
                </td>
                <td>{u.subscriptions[0] ? `${u.subscriptions[0].tier.replace("_", " + ").toLowerCase()} (${u.subscriptions[0].status.toLowerCase()})` : <span className="text-muted">free</span>}</td>
                <td className="num">{u.profile?.reputation ?? 0}</td>
                <td>{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 100 ? <p className="mt-2 text-xs text-muted">Showing the 100 most recent matches. Narrow the search to see others.</p> : null}
    </>
  );
}
