"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { createPracticeSet, gradeSet, SECTION_PARTS } from "@/server/practice";
import { PART_ENUM, type PartCode } from "@/lib/content/schema";

const PART = z.enum(SECTION_PARTS);
const DIFF = z.enum(["INTRO", "CORE", "ADVANCED"]);

async function userOrSignIn(next: string) {
  const s = await getSession();
  if (!s) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return s.user;
}

export type StartState = { error?: string };

const customSchema = z.object({
  parts: z.array(PART).default([]),
  topics: z.array(z.string().max(12)).max(40).default([]),
  difficulties: z.array(DIFF).default([]),
  status: z.enum(["all", "unseen", "correct", "incorrect", "flagged"]).default("all"),
  count: z.coerce.number().int().min(1).max(100),
  timed: z.enum(["on"]).optional(),
  secondsPerQuestion: z.coerce.number().int().min(30).max(300).default(96),
});

export async function startCustomSet(_prev: StartState, form: FormData): Promise<StartState> {
  const user = await userOrSignIn("/practice/new");
  const parsed = customSchema.safeParse({
    parts: form.getAll("parts"),
    topics: form.getAll("topics"),
    difficulties: form.getAll("difficulties"),
    status: form.get("status") ?? undefined,
    count: form.get("count"),
    timed: form.get("timed") ?? undefined,
    secondsPerQuestion: form.get("secondsPerQuestion") ?? undefined,
  });
  if (!parsed.success) return { error: "Please check your choices." };
  const ent = await getEntitlement();
  const timed = parsed.data.timed === "on";
  if (timed && !can(ent, "practice.timed")) return { error: "Timed sets are part of Premium." };
  const created = await createPracticeSet(user.id, ent, {
    mode: "CUSTOM",
    filters: {
      parts: parsed.data.parts,
      topics: parsed.data.topics,
      difficulties: parsed.data.difficulties,
      status: parsed.data.status,
    },
    count: parsed.data.count,
    timed,
    secondsPerQuestion: parsed.data.secondsPerQuestion,
  });
  if (!created) return { error: "No questions match those filters. Try widening them." };
  redirect(`/practice/${created.id}`);
}

export async function startSectionTest(form: FormData) {
  const user = await userOrSignIn("/practice/test");
  const part = PART.parse(form.get("part"));
  const ent = await getEntitlement();
  if (!can(ent, "practice.sectionTest")) redirect("/pricing");
  const created = await createPracticeSet(user.id, ent, {
    mode: "SECTION_TEST",
    filters: { parts: [part] },
    count: 0,
    timed: true,
    sectionPart: part,
  });
  if (!created) redirect("/practice/test?empty=1");
  redirect(`/practice/${created.id}`);
}

export async function startChapterQuiz(form: FormData) {
  const part = z.string().max(40).parse(form.get("part")) as PartCode;
  const slug = z.string().max(120).parse(form.get("slug"));
  const user = await userOrSignIn(`/${part}/${slug}/quiz`);
  const chapter = await db.chapter.findUnique({ where: { slug }, select: { id: true, part: true, access: true, status: true } });
  if (!chapter || chapter.part !== PART_ENUM[part] || chapter.status !== "PUBLISHED") redirect("/");
  const ent = await getEntitlement();
  if (chapter.access === "PREMIUM" && !can(ent, "content.premium")) redirect("/pricing");
  // Resume an unfinished attempt rather than starting a second one.
  const open = await db.practiceSet.findFirst({
    where: { userId: user.id, chapterId: chapter.id, mode: "CHAPTER_QUIZ", status: "IN_PROGRESS" },
    select: { id: true },
  });
  const set = open ?? (await createPracticeSet(user.id, ent, { mode: "CHAPTER_QUIZ", filters: {}, count: 0, timed: false, chapterId: chapter.id }));
  if (!set) redirect(`/${part}/${slug}`);
  redirect(`/practice/${set.id}`);
}

const saveItemSchema = z.object({
  questionId: z.string().max(40),
  selected: z.enum(["A", "B", "C", "D"]).nullable().optional(),
  marked: z.boolean().optional(),
  addTimeMs: z.number().int().min(0).max(30 * 60_000).default(0),
});
const saveBatchSchema = z.object({ setId: z.string().max(40), items: z.array(saveItemSchema).min(1).max(120) });

/** Autosaves a batch of answer/mark/time changes. Rejected once the set is submitted or past its deadline. */
export async function saveAnswers(raw: z.input<typeof saveBatchSchema>) {
  const s = await getSession();
  if (!s) return { ok: false as const, reason: "signed-out" as const };
  const { setId, items } = saveBatchSchema.parse(raw);
  const set = await db.practiceSet.findFirst({
    where: { id: setId, userId: s.user.id },
    select: { status: true, deadlineAt: true },
  });
  if (!set || set.status !== "IN_PROGRESS") return { ok: false as const, reason: "closed" as const };
  if (set.deadlineAt && Date.now() > set.deadlineAt.getTime() + 5_000) return { ok: false as const, reason: "time-up" as const };
  await db.$transaction(
    items.map(({ questionId, selected, marked, addTimeMs }) =>
      db.practiceSetItem.update({
        where: { practiceSetId_questionId: { practiceSetId: setId, questionId } },
        data: {
          ...(selected !== undefined ? { selected } : {}),
          ...(marked !== undefined ? { markedForReview: marked } : {}),
          timeSpentMs: { increment: addTimeMs },
        },
      }),
    ),
  );
  return { ok: true as const };
}

export async function submitSet(setId: string) {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  await gradeSet(z.string().max(40).parse(setId), s.user.id);
  redirect(`/practice/${setId}/review`);
}

export async function abandonSet(setId: string) {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  await db.practiceSet.updateMany({ where: { id: setId, userId: s.user.id, status: "IN_PROGRESS" }, data: { status: "ABANDONED" } });
  redirect("/practice");
}

export async function toggleFlag(questionId: string, flagged: boolean) {
  const s = await getSession();
  if (!s) return { ok: false as const };
  const id = z.string().max(40).parse(questionId);
  await db.userQuestionStatus.upsert({
    where: { userId_questionId: { userId: s.user.id, questionId: id } },
    create: { userId: s.user.id, questionId: id, flagged },
    update: { flagged },
  });
  return { ok: true as const };
}
