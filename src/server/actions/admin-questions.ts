"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth";
import { prepareQuestion, type AdminQuestionInput } from "@/server/admin-questions";
import { parseCsvObjects } from "@/lib/csv";

export type QuestionFormState = { errors?: string[] };

/** Create (questionId = null) or update a question from the admin form. */
export async function saveQuestion(questionId: string | null, _prev: QuestionFormState, form: FormData): Promise<QuestionFormState> {
  const admin = await requireRole("ADMIN");
  const raw = Object.fromEntries(form) as Record<string, string>;
  const prepared = await prepareQuestion({
    ...raw,
    in_bank: raw.in_bank === "on",
    is_free: raw.is_free === "on",
    published: raw.published === "on",
  } as AdminQuestionInput);
  if ("errors" in prepared) return { errors: prepared.errors };
  const clash = await db.question.findUnique({ where: { key: prepared.key }, select: { id: true } });
  if (clash && clash.id !== questionId) return { errors: [`key: "${prepared.key}" is already used by another question`] };
  const saved = questionId
    ? await db.question.update({ where: { id: questionId }, data: { key: prepared.key, ...prepared.data }, select: { id: true } })
    : await db.question.create({ data: { key: prepared.key, ...prepared.data, authorId: admin.id }, select: { id: true } });
  revalidatePath("/admin/questions");
  redirect(`/admin/questions/${saved.id}?saved=1`);
}

export type ImportState = {
  done?: boolean;
  dryRun?: boolean;
  created?: number;
  updated?: number;
  errors?: { row: number; key: string; problems: string[] }[];
  fatal?: string;
};

const MAX_ROWS = 2000;
type Prepared = Extract<Awaited<ReturnType<typeof prepareQuestion>>, { key: string }>;

/**
 * Bulk import from CSV. Rows are validated first; nothing is written if any row fails.
 * Rows upsert by `key`, so re-importing an edited sheet updates questions in place.
 */
export async function importQuestionsCsv(_prev: ImportState, form: FormData): Promise<ImportState> {
  const admin = await requireRole("ADMIN");
  const file = form.get("file");
  const dryRun = form.get("dryRun") === "on";
  if (!(file instanceof File) || !file.size) return { fatal: "Choose a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { fatal: "The file is larger than 5 MB." };
  let rows: Record<string, string>[];
  try {
    rows = parseCsvObjects(await file.text());
  } catch (err) {
    return { fatal: `Couldn't read the CSV: ${(err as Error).message}` };
  }
  if (!rows.length) return { fatal: "The CSV has no data rows." };
  if (rows.length > MAX_ROWS) return { fatal: `Import at most ${MAX_ROWS} rows at a time.` };
  if (!("key" in rows[0]) || !("stem" in rows[0])) return { fatal: "Missing required columns. Download the template for the expected header row." };

  const prepared = await Promise.all(rows.map((r) => prepareQuestion(r as AdminQuestionInput)));
  const errors: NonNullable<ImportState["errors"]> = [];
  const seen = new Map<string, number>();
  prepared.forEach((p, i) => {
    const row = i + 2; // +1 for header, +1 for 1-based rows
    if ("errors" in p) errors.push({ row, key: rows[i].key ?? "", problems: p.errors ?? [] });
    else if (seen.has(p.key)) errors.push({ row, key: p.key, problems: [`duplicate key (also on row ${seen.get(p.key)})`] });
    else seen.set(p.key, row);
  });
  if (errors.length) return { done: true, dryRun, errors };

  const valid = prepared as Prepared[];
  const existing = new Set((await db.question.findMany({ where: { key: { in: valid.map((v) => v.key) } }, select: { key: true } })).map((q) => q.key));
  const created = valid.filter((v) => !existing.has(v.key)).length;
  if (dryRun) return { done: true, dryRun, created, updated: valid.length - created };

  await db.$transaction(
    valid.map((v) =>
      db.question.upsert({ where: { key: v.key }, create: { key: v.key, ...v.data, authorId: admin.id }, update: v.data }),
    ),
  );
  revalidatePath("/admin/questions");
  return { done: true, dryRun, created, updated: valid.length - created };
}
