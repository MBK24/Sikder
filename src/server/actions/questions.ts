"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { bumpStudyDay } from "@/server/study-day";
import { getContentQuestion } from "@/server/content/book";
import { markdownToHtml } from "@/lib/content/markdown";
import { can, getEntitlement } from "@/server/entitlements";

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
    select: { id: true, correct: true, explanation: true, choices: true, published: true, inBank: true, isFree: true },
  });
  if (context === "INLINE" && dbq?.inBank) {
    // Inline grading is only for questions embedded in chapters; bank/quiz questions go through practice sets.
    throw new Error("Question not found");
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
