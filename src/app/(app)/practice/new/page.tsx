import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { db } from "@/server/db";
import { NewSetForm } from "@/components/practice/NewSetForm";
import { Upsell } from "@/components/ui/Upsell";
import { FREE_QBANK_QUESTIONS } from "@/config/pricing";

export const metadata: Metadata = { title: "Build a practice set", robots: { index: false } };

export default function NewSetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Build a practice set</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser("/practice/new");
  const sp = await searchParams;
  const ent = await getEntitlement();
  const topics = await db.topic.findMany({ orderBy: [{ part: "asc" }, { code: "asc" }], select: { code: true, name: true, part: true } });
  const parts = ([] as string[]).concat(sp.part ?? []);
  return (
    <>
      {!can(ent, "qbank.full") ? (
        <div className="mt-6">
          <Upsell title={`Free plan: sets draw from ${FREE_QBANK_QUESTIONS} sample questions`} compact>
            Premium unlocks the full question bank, timed sets, and section tests.
          </Upsell>
        </div>
      ) : null}
      <NewSetForm
        topics={topics.filter((t) => ["CP", "CARS", "BB", "PS"].includes(t.part))}
        canTime={can(ent, "practice.timed")}
        initial={{ parts, status: typeof sp.status === "string" ? sp.status : "all" }}
      />
    </>
  );
}
