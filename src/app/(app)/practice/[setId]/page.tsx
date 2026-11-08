import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { expireIfOverdue, loadSetForTaking, PART_TO_CODE } from "@/server/practice";
import { TestRunner } from "@/components/practice/TestRunner";
import { MCAT_SECTIONS } from "@/config/mcat";

export const metadata: Metadata = { title: "Practice", robots: { index: false } };

export default function TakeSetPage({ params }: { params: Promise<{ setId: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-[760px] px-4 py-16 font-sans text-muted">Loading your questions…</p>}>
      <TakeSet params={params} />
    </Suspense>
  );
}

async function TakeSet({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const user = await requireUser(`/practice/${setId}`);
  await expireIfOverdue(setId, user.id);
  const data = await loadSetForTaking(setId, user.id);
  if (!data) notFound();
  const { set, items, passages } = data;
  if (set.status === "SUBMITTED") redirect(`/practice/${set.id}/review`);
  if (set.status === "ABANDONED") redirect("/practice");

  const title =
    set.mode === "CHAPTER_QUIZ"
      ? `Chapter quiz: ${set.chapter?.title ?? ""}`
      : set.mode === "SECTION_TEST" && set.part && set.part in PART_TO_CODE
        ? `Section test: ${MCAT_SECTIONS[PART_TO_CODE[set.part as keyof typeof PART_TO_CODE]].label}`
        : `Practice set · ${items.length} question${items.length === 1 ? "" : "s"}`;

  return (
    <TestRunner
      setId={set.id}
      title={title}
      items={items}
      passages={passages}
      deadlineAt={set.deadlineAt?.toISOString() ?? null}
      timeLimitSec={set.timeLimitSec}
    />
  );
}
