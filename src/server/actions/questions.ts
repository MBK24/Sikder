"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { bumpStudyDay } from "@/server/study-day";
import { getContentQuestion } from "@/server/content/book";
import { markdownToHtml } from "@/lib/content/markdown";
import { can, getEntitlement } from "@/server/entitlements";
import { getChapter } from "@/server/content/book";
import { chapterSplit } from "@/server/content/render";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c]));

/** Inline questions in the gated part of a premium chapter can only be graded by readers with access. */
async function inlineQuestionAllowed(chapterId: string | null, key: string) {
  if (!chapterId) return true;
  const chapter = await db.chapter.findUnique({ where: { id: chapterId }, select: { access: true, part: true, slug: true } });
  if (!chapter || chapter.access === "FREE") return true;
  if (can(await getEntitlement(), "content.premium")) return true;
  const c = getChapter(ENUM_TO_CODE[chapter.part], chapter.slug);
  return Boolean(c && chapterSplit(c.file).preview.includes(`id="${key}"`));
}

const input = z.object({
  key: z.string().min(1).max(100),
  selected: z.enum(["A", "B", "C", "D"]),
  timeSpentMs: z.number().int().min(0).max(60 * 60 * 1000),
  context: z.enum(["INLINE", "PRACTICE"]).default("INLINE"),
});

export interface AnswerResult {
  correct: boolean;
  answer: "A" | "B" | "C" | "D";
  explanationHtml: string;
  whyWrongHtml: Partial<Record<"A" | "B" | "C" | "D", string>>;
  saved: boolean;
}

/**
 * Grades an inline question. The answer and explanation are only revealed here,
 * after the reader commits to a choice. Signed-in readers have the attempt recorded.
 */
export async function answerInlineQuestion(raw: z.input<typeof input>): Promise<AnswerResult> {
  const { key, selected, timeSpentMs, context } = input.parse(raw);
  const session = await getSession();

  const dbq = await db.question.findUnique({
    where: { key },
    select: { id: true, correct: true, explanation: true, choices: true, published: true, inBank: true, isFree: true, chapterId: true },
  });
  if (context === "INLINE" && dbq?.inBank) {
    // Inline grading is only for questions embedded in chapters; bank/quiz questions go through practice sets.
    throw new Error("Question not found");
  }
  if (context === "INLINE" && dbq && !(await inlineQuestionAllowed(dbq.chapterId, key))) {
    throw new Error("Upgrade required");
  }
  if (context === "PRACTICE") {
    // Single-question practice from the bank: same access rules as the bank itself.
    if (!dbq || !dbq.published || !dbq.inBank) throw new Error("Question not found");
    if (!dbq.isFree && !can(await getEntitlement(), "qbank.full")) throw new Error("Upgrade required");
  }
  const yamlq = getContentQuestion(key);
  if (!dbq && !yamlq) throw new Error("Question not found");

  const answer = (dbq?.correct ?? yamlq!.answer) as AnswerResult["answer"];
  const explanation = dbq?.explanation ?? yamlq!.explanation;
  const whyWrongSrc: Record<string, string> =
    (dbq?.choices as { id: string; explanation?: string }[] | undefined)?.reduce<Record<string, string>>((acc, c) => {
      if (c.explanation) acc[c.id] = c.explanation;
      return acc;
    }, {}) ?? yamlq?.whyWrong ?? {};
  const correct = selected === answer;

  let saved = false;
  if (session && dbq) {
    const userId = session.user.id;
    await db.$transaction([
      db.questionAttempt.create({
        data: { userId, questionId: dbq.id, selected, correct, timeSpentMs, context },
      }),
      db.userQuestionStatus.upsert({
        where: { userId_questionId: { userId, questionId: dbq.id } },
        create: { userId, questionId: dbq.id, lastResult: correct ? "CORRECT" : "INCORRECT", attempts: 1, lastAttemptAt: new Date() },
        update: { lastResult: correct ? "CORRECT" : "INCORRECT", attempts: { increment: 1 }, lastAttemptAt: new Date() },
      }),
    ]);
    await bumpStudyDay(userId, { questionsAnswered: 1, questionsCorrect: correct ? 1 : 0 });
    saved = true;
  }

  return {
    correct,
    answer,
    explanationHtml: markdownToHtml(explanation),
    whyWrongHtml: Object.fromEntries(Object.entries(whyWrongSrc).map(([k, v]) => [k, markdownToHtml(v)])),
    saved,
  };
}
