import { z } from "zod";

/** URL codes for the book's Parts, in display order. */
export const PART_CODES = ["getting-started", "cp", "cars", "bb", "ps", "appendix"] as const;
export type PartCode = (typeof PART_CODES)[number];

/** Maps URL part codes to the Prisma `Part` enum. */
export const PART_ENUM: Record<PartCode, "GETTING_STARTED" | "CP" | "CARS" | "BB" | "PS" | "APPENDIX"> = {
  "getting-started": "GETTING_STARTED",
  cp: "CP",
  cars: "CARS",
  bb: "BB",
  ps: "PS",
  appendix: "APPENDIX",
};

export const CALLOUT_TYPES = ["high-yield", "trap", "mnemonic", "connection", "note"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** Components an author may use inside MDX. Anything else fails `content:check`. */
export const ALLOWED_COMPONENTS = ["Callout", "Question", "Figure"] as const;

const aamcCode = z
  .string()
  .regex(/^(?:[4-5][A-E]|[1-3][A-D]|[6-9][A-C]|10A|CARS-(?:FC|RWT|RBT))$/, "Not a valid AAMC content-category code");

export const chapterFrontmatterSchema = z
  .object({
    title: z.string().min(3),
    summary: z.string().min(20).max(300),
    estReadMinutes: z.number().int().min(3).max(120),
    difficulty: z.enum(["intro", "core", "advanced"]),
    access: z.enum(["free", "premium"]),
    status: z.enum(["draft", "coming-soon", "published"]).default("published"),
    aamc: z.array(aamcCode).default([]),
    /** Optional manual override of where the free preview ends (heading anchor). */
    previewEndsBefore: z.string().optional(),
  })
  .strict();
export type ChapterFrontmatter = z.infer<typeof chapterFrontmatterSchema>;

const choiceKey = z.enum(["A", "B", "C", "D"]);

export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids are kebab-case"),
    usage: z.enum(["inline", "quiz", "bank"]),
    topic: aamcCode,
    difficulty: z.enum(["intro", "core", "advanced"]),
    /** Optional passage id (see `passages:` in the same file). */
    passage: z.string().optional(),
    stem: z.string().min(10),
    choices: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }).strict(),
    answer: choiceKey,
    explanation: z.string().min(40),
    /** Optional per-choice rationale shown after answering. */
    whyWrong: z.partialRecord(choiceKey, z.string()).optional(),
  })
  .strict();
export type QuestionYaml = z.infer<typeof questionSchema>;

export const passageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().optional(),
    body: z.string().min(200),
  })
  .strict();

export const questionFileSchema = z
  .object({
    chapter: z.string().optional(),
    passages: z.array(passageSchema).default([]),
    questions: z.array(questionSchema).min(1),
  })
  .strict();
export type QuestionFile = z.infer<typeof questionFileSchema>;

export const flashcardFileSchema = z
  .object({
    deck: z.object({ title: z.string(), description: z.string().optional() }).strict(),
    cards: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            front: z.string().min(2),
            back: z.string().min(1),
            tags: z.array(z.string()).default([]),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type FlashcardFile = z.infer<typeof flashcardFileSchema>;

export const comingSoonSchema = z.object({
  chapters: z.array(z.object({ title: z.string(), aamc: z.array(aamcCode).default([]) }).strict()),
});

export const partsFileSchema = z.object({
  parts: z.array(
    z
      .object({
        code: z.enum(PART_CODES),
        label: z.string(), // "Part 1"
        title: z.string(),
        short: z.string(), // "C/P"
        prefix: z.string(), // chapter-number prefix, "CP"; "" for unnumbered parts
        intro: z.string(),
      })
      .strict(),
  ),
});
