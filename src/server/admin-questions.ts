import "server-only";
import { z } from "zod";
import { db } from "./db";
import { markdownToHtml } from "@/lib/content/markdown";
import type { Prisma } from "@/generated/prisma/client";

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes", "y", "on"].includes(v.trim().toLowerCase())));

/** One question as entered in the admin form or a CSV row. */
export const adminQuestionSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "key must be kebab-case (letters, numbers, dashes)")
    .max(80),
  part: z.enum(["CP", "CARS", "BB", "PS"]),
  topic: z.string().trim().max(12).optional().default(""),
  difficulty: z.enum(["INTRO", "CORE", "ADVANCED"]).default("CORE"),
  chapter: z.string().trim().max(120).optional().default(""),
  passage: z.string().trim().max(80).optional().default(""),
  stem: z.string().trim().min(10, "stem is too short").max(10_000),
  a: z.string().trim().min(1, "choice A is empty").max(2000),
  b: z.string().trim().min(1, "choice B is empty").max(2000),
  c: z.string().trim().min(1, "choice C is empty").max(2000),
  d: z.string().trim().min(1, "choice D is empty").max(2000),
  answer: z.string().trim().toUpperCase().pipe(z.enum(["A", "B", "C", "D"])),
  explanation: z.string().trim().min(20, "explanation is too short").max(10_000),
  why_a: z.string().trim().max(2000).optional().default(""),
  why_b: z.string().trim().max(2000).optional().default(""),
  why_c: z.string().trim().max(2000).optional().default(""),
  why_d: z.string().trim().max(2000).optional().default(""),
  in_bank: bool.default(true),
  is_free: bool.default(false),
  published: bool.default(true),
});
export type AdminQuestionInput = z.input<typeof adminQuestionSchema>;

export const CSV_COLUMNS = [
  "key", "part", "topic", "difficulty", "chapter", "passage", "stem", "a", "b", "c", "d", "answer", "explanation",
  "why_a", "why_b", "why_c", "why_d", "in_bank", "is_free", "published",
] as const;

/** Validates references and math, then returns Prisma data (or a list of problems). */
export async function prepareQuestion(raw: AdminQuestionInput) {
  const parsed = adminQuestionSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`) };
  const q = parsed.data;
  const errors: string[] = [];
  const [topic, chapter, passage] = await Promise.all([
    q.topic ? db.topic.findFirst({ where: { code: q.topic.toUpperCase() }, select: { id: true } }) : null,
    q.chapter ? db.chapter.findUnique({ where: { slug: q.chapter }, select: { id: true } }) : null,
    q.passage ? db.passage.findUnique({ where: { key: q.passage }, select: { id: true } }) : null,
  ]);
  if (q.topic && !topic) errors.push(`topic: unknown AAMC code "${q.topic}"`);
  if (q.chapter && !chapter) errors.push(`chapter: no chapter with slug "${q.chapter}"`);
  if (q.passage && !passage) errors.push(`passage: no passage with key "${q.passage}"`);
  for (const [field, text] of Object.entries({ stem: q.stem, a: q.a, b: q.b, c: q.c, d: q.d, explanation: q.explanation })) {
    if (markdownToHtml(text).includes("katex-error")) errors.push(`${field}: contains LaTeX that doesn't render`);
  }
  if (errors.length) return { errors };
  const why = { A: q.why_a, B: q.why_b, C: q.why_c, D: q.why_d };
  const data = {
    part: q.part,
    topicId: topic?.id ?? null,
    chapterId: chapter?.id ?? null,
    passageId: passage?.id ?? null,
    difficulty: q.difficulty,
    stem: q.stem,
    choices: (["A", "B", "C", "D"] as const).map((id) => ({
      id,
      text: q[id.toLowerCase() as "a"],
      ...(why[id] && id !== q.answer ? { explanation: why[id] } : {}),
    })) as Prisma.InputJsonValue,
    correct: q.answer,
    explanation: q.explanation,
    inBank: q.in_bank,
    isFree: q.is_free,
    published: q.published,
    // Admin edits take ownership: `content:sync` never overwrites ADMIN-sourced questions.
    source: "ADMIN" as const,
  };
  return { key: q.key, data };
}

/** Flattens a stored question back into form/CSV fields. */
export function questionToFields(q: {
  key: string;
  part: string;
  difficulty: string;
  stem: string;
  correct: string;
  explanation: string;
  inBank: boolean;
  isFree: boolean;
  published: boolean;
  choices: unknown;
  topic: { code: string } | null;
  chapter: { slug: string } | null;
  passage: { key: string } | null;
}) {
  const ch = q.choices as { id: string; text: string; explanation?: string }[];
  const get = (id: string) => ch.find((c) => c.id === id);
  return {
    key: q.key,
    part: q.part,
    topic: q.topic?.code ?? "",
    difficulty: q.difficulty,
    chapter: q.chapter?.slug ?? "",
    passage: q.passage?.key ?? "",
    stem: q.stem,
    a: get("A")?.text ?? "",
    b: get("B")?.text ?? "",
    c: get("C")?.text ?? "",
    d: get("D")?.text ?? "",
    answer: q.correct,
    explanation: q.explanation,
    why_a: get("A")?.explanation ?? "",
    why_b: get("B")?.explanation ?? "",
    why_c: get("C")?.explanation ?? "",
    why_d: get("D")?.explanation ?? "",
    in_bank: q.inBank,
    is_free: q.isFree,
    published: q.published,
  };
}
