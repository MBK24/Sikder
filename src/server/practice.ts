import "server-only";
import { db } from "./db";
import { can, type Entitlement } from "./entitlements";
import { bumpStudyDay } from "./study-day";
import { markdownToHtml, inlineMarkdownToHtml } from "@/lib/content/markdown";
import { MCAT_SECTIONS } from "@/config/mcat";
import type { Prisma } from "@/generated/prisma/client";
import { arrangeLikeExam, estimateScaled } from "@/lib/scoring";
export { arrangeLikeExam, estimateScaled };
import type { Part, Difficulty, PracticeMode, QuestionResult } from "@/generated/prisma/enums";

export type ChoiceId = "A" | "B" | "C" | "D";
export interface StoredChoice {
  id: ChoiceId;
  text: string;
  explanation?: string;
}

export const SECTION_PARTS = ["CP", "CARS", "BB", "PS"] as const satisfies readonly Part[];
export const PART_LABEL: Record<(typeof SECTION_PARTS)[number], string> = { CP: "C/P", CARS: "CARS", BB: "B/B", PS: "P/S" };
export const PART_TO_CODE = { CP: "cp", CARS: "cars", BB: "bb", PS: "ps" } as const;

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** Base filter for questions this user may practice in the bank / custom sets. */
export function bankAccessWhere(ent: Entitlement): Prisma.QuestionWhereInput {
  return {
    published: true,
    inBank: true,
    part: { in: [...SECTION_PARTS] },
    ...(can(ent, "qbank.full") ? {} : { isFree: true }),
  };
}

export interface BankFilters {
  parts?: Part[];
  topics?: string[]; // AAMC codes
  difficulties?: Difficulty[];
  status?: "all" | "unseen" | "correct" | "incorrect" | "flagged";
}

export function bankWhere(ent: Entitlement, userId: string | null, f: BankFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { ...bankAccessWhere(ent) };
  const and: Prisma.QuestionWhereInput[] = [];
  if (f.parts?.length) and.push({ part: { in: f.parts } });
  if (f.topics?.length) and.push({ topic: { code: { in: f.topics } } });
  if (f.difficulties?.length) and.push({ difficulty: { in: f.difficulties } });
  if (userId && f.status && f.status !== "all") {
    if (f.status === "unseen") {
      and.push({ userStatuses: { none: { userId, lastResult: { not: "UNSEEN" } } } });
    } else if (f.status === "flagged") {
      and.push({ userStatuses: { some: { userId, flagged: true } } });
    } else {
      const lastResult: QuestionResult = f.status === "correct" ? "CORRECT" : "INCORRECT";
      and.push({ userStatuses: { some: { userId, lastResult } } });
    }
  }
  if (and.length) where.AND = and;
  return where;
}

// ---------------------------------------------------------------------------
// Building sets
// ---------------------------------------------------------------------------

export interface CreateSetInput {
  mode: PracticeMode;
  filters: BankFilters;
  count: number;
  timed: boolean;
  /** Seconds per question for CUSTOM timed sets. */
  secondsPerQuestion?: number;
  chapterId?: string;
  sectionPart?: (typeof SECTION_PARTS)[number];
}

export async function createPracticeSet(userId: string, ent: Entitlement, input: CreateSetInput) {
  let questionIds: string[];
  let timeLimitSec: number | null = null;
  let part: Part | null = null;

  if (input.mode === "CHAPTER_QUIZ") {
    const items = await db.chapterQuizItem.findMany({
      where: { chapterId: input.chapterId!, question: { published: true } },
      orderBy: { order: "asc" },
      select: { questionId: true },
    });
    questionIds = items.map((i) => i.questionId);
  } else if (input.mode === "SECTION_TEST") {
    part = input.sectionPart!;
    const spec = MCAT_SECTIONS[PART_TO_CODE[part]];
    const candidates = await db.question.findMany({
      where: { ...bankAccessWhere(ent), part },
      select: { id: true, passageId: true, passageOrder: true },
    });
    questionIds = arrangeLikeExam(candidates, spec.questions);
    // Real per-section time; scaled down proportionally if the bank can't fill a full section yet.
    timeLimitSec = Math.round((spec.minutes * 60 * questionIds.length) / spec.questions);
  } else {
    const candidates = await db.question.findMany({
      where: bankWhere(ent, userId, input.filters),
      select: { id: true, passageId: true, passageOrder: true },
    });
    questionIds = arrangeLikeExam(candidates, input.count);
    if (input.timed) timeLimitSec = questionIds.length * (input.secondsPerQuestion ?? 96);
    if (input.filters.parts?.length === 1) part = input.filters.parts[0];
  }

  if (!questionIds.length) return null;
  const now = new Date();
  return db.practiceSet.create({
    data: {
      userId,
      mode: input.mode,
      part,
      chapterId: input.chapterId ?? null,
      config: { filters: input.filters, count: input.count, timed: input.timed } as unknown as Prisma.InputJsonValue,
      timeLimitSec,
      startedAt: now,
      deadlineAt: timeLimitSec ? new Date(now.getTime() + timeLimitSec * 1000) : null,
      scoreTotal: questionIds.length,
      items: { create: questionIds.map((questionId, i) => ({ questionId, order: i + 1 })) },
    },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// Taking a set
// ---------------------------------------------------------------------------

export async function loadSetForTaking(setId: string, userId: string) {
  const set = await db.practiceSet.findFirst({
    where: { id: setId, userId },
    include: {
      chapter: { select: { title: true, slug: true, part: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          question: {
            select: {
              id: true,
              key: true,
              stem: true,
              choices: true,
              part: true,
              passage: { select: { id: true, title: true, body: true } },
            },
          },
        },
      },
    },
  });
  if (!set) return null;
  const passages = new Map<string, { id: string; title: string | null; html: string }>();
  const items = set.items.map((it) => {
    const p = it.question.passage;
    if (p && !passages.has(p.id)) passages.set(p.id, { id: p.id, title: p.title, html: markdownToHtml(p.body) });
    return {
      questionId: it.questionId,
      order: it.order,
      selected: (it.selected as ChoiceId | null) ?? null,
      marked: it.markedForReview,
      timeSpentMs: it.timeSpentMs,
      passageId: p?.id ?? null,
      stemHtml: markdownToHtml(it.question.stem),
      choices: (it.question.choices as unknown as StoredChoice[]).map((c) => ({ id: c.id, html: inlineMarkdownToHtml(c.text) })),
    };
  });
  return { set, items, passages: Object.fromEntries(passages) };
}

/** Auto-submits a timed set whose deadline has passed (with a small grace for network latency). */
export async function expireIfOverdue(setId: string, userId: string) {
  const set = await db.practiceSet.findFirst({ where: { id: setId, userId }, select: { status: true, deadlineAt: true } });
  if (set?.status === "IN_PROGRESS" && set.deadlineAt && Date.now() > set.deadlineAt.getTime() + 15_000) {
    await gradeSet(setId, userId);
  }
}

const CONTEXT_FOR_MODE = { CHAPTER_QUIZ: "QUIZ", CUSTOM: "PRACTICE", SECTION_TEST: "TEST" } as const;

export async function gradeSet(setId: string, userId: string) {
  const set = await db.practiceSet.findFirst({
    where: { id: setId, userId, status: "IN_PROGRESS" },
    include: { items: { include: { question: { select: { id: true, correct: true } } } } },
  });
  if (!set) return null;
  const context = CONTEXT_FOR_MODE[set.mode];
  const graded = set.items.map((it) => ({
    it,
    correct: it.selected !== null && it.selected === it.question.correct,
  }));
  const correctCount = graded.filter((g) => g.correct).length;
  const answered = graded.filter((g) => g.it.selected !== null);
  const now = new Date();

  // Guard against double-submit: only the request that flips the status records attempts.
  const flipped = await db.practiceSet.updateMany({
    where: { id: set.id, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      scoreCorrect: correctCount,
      scoreTotal: set.items.length,
      scaledEstimate: set.mode === "SECTION_TEST" ? estimateScaled(correctCount, set.items.length) : null,
    },
  });
  if (!flipped.count) return set.id;

  await db.$transaction([
    db.questionAttempt.createMany({
      data: graded.map(({ it, correct }) => ({
        userId,
        questionId: it.questionId,
        selected: it.selected,
        correct,
        timeSpentMs: it.timeSpentMs,
        context,
        practiceSetId: set.id,
        createdAt: now,
      })),
    }),
    ...answered.map(({ it, correct }) =>
      db.userQuestionStatus.upsert({
        where: { userId_questionId: { userId, questionId: it.questionId } },
        create: { userId, questionId: it.questionId, lastResult: correct ? "CORRECT" : "INCORRECT", attempts: 1, lastAttemptAt: now },
        update: { lastResult: correct ? "CORRECT" : "INCORRECT", attempts: { increment: 1 }, lastAttemptAt: now },
      }),
    ),
  ]);
  await bumpStudyDay(userId, { questionsAnswered: answered.length, questionsCorrect: correctCount });
  return set.id;
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function loadReview(setId: string, userId: string) {
  const set = await db.practiceSet.findFirst({
    where: { id: setId, userId, status: "SUBMITTED" },
    include: {
      chapter: { select: { title: true, slug: true, part: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          question: {
            select: {
              id: true,
              key: true,
              stem: true,
              choices: true,
              correct: true,
              explanation: true,
              difficulty: true,
              topic: { select: { code: true, name: true } },
              passage: { select: { id: true, title: true, body: true } },
            },
          },
        },
      },
    },
  });
  if (!set) return null;
  const flags = await db.userQuestionStatus.findMany({
    where: { userId, questionId: { in: set.items.map((i) => i.questionId) }, flagged: true },
    select: { questionId: true },
  });
  const flagged = new Set(flags.map((f) => f.questionId));

  const topics = new Map<string, { code: string; name: string; correct: number; total: number; timeMs: number }>();
  const passages = new Map<string, { title: string | null; html: string }>();
  const items = set.items.map((it) => {
    const q = it.question;
    const correct = it.selected !== null && it.selected === q.correct;
    const key = q.topic?.code ?? "other";
    const t = topics.get(key) ?? { code: key, name: q.topic?.name ?? "Other", correct: 0, total: 0, timeMs: 0 };
    t.total++;
    t.timeMs += it.timeSpentMs;
    if (correct) t.correct++;
    topics.set(key, t);
    if (q.passage && !passages.has(q.passage.id)) passages.set(q.passage.id, { title: q.passage.title, html: markdownToHtml(q.passage.body) });
    const choices = q.choices as unknown as StoredChoice[];
    return {
      questionId: q.id,
      key: q.key,
      order: it.order,
      selected: it.selected as ChoiceId | null,
      answer: q.correct as ChoiceId,
      correct,
      timeSpentMs: it.timeSpentMs,
      flagged: flagged.has(q.id),
      passageId: q.passage?.id ?? null,
      topic: q.topic,
      difficulty: q.difficulty,
      stemHtml: markdownToHtml(q.stem),
      explanationHtml: markdownToHtml(q.explanation),
      choices: choices.map((c) => ({
        id: c.id,
        html: inlineMarkdownToHtml(c.text),
        whyHtml: c.explanation ? markdownToHtml(c.explanation) : null,
      })),
    };
  });
  return {
    set,
    items,
    passages: Object.fromEntries(passages),
    topics: [...topics.values()].sort((a, b) => a.correct / a.total - b.correct / b.total),
  };
}
