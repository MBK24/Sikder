import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "../db";
import {
  listChapterFiles,
  readChapterFile,
  readComingSoon,
  readParts,
  readQuestionFiles,
  type ChapterFile,
} from "@/lib/content/files";
import type { PartCode, QuestionYaml } from "@/lib/content/schema";

export interface NavChapter {
  part: PartCode;
  slug: string;
  number: number;
  /** "CP 2", or null for unnumbered parts (Getting Started, Appendix) */
  label: string | null;
  title: string;
  summary: string;
  href: string;
  access: "free" | "premium";
  status: "draft" | "coming-soon" | "published";
  estReadMinutes: number;
  difficulty: "intro" | "core" | "advanced";
}

export interface NavPart {
  code: PartCode;
  label: string;
  title: string;
  short: string;
  prefix: string;
  intro: string;
  href: string;
  chapters: NavChapter[];
  comingSoon: { title: string }[];
}

let bookCache: { parts: NavPart[]; files: Map<string, ChapterFile> } | null = null;

function load() {
  if (bookCache && process.env.NODE_ENV === "production") return bookCache;
  const files = new Map<string, ChapterFile>();
  const parts: NavPart[] = readParts().map((p) => ({
    ...p,
    href: `/${p.code}`,
    chapters: [],
    comingSoon: readComingSoon(p.code).map((c) => ({ title: c.title })),
  }));
  for (const entry of listChapterFiles()) {
    const file = readChapterFile(entry);
    if (file.frontmatter.status === "draft" && process.env.NODE_ENV === "production") continue;
    const part = parts.find((p) => p.code === entry.part)!;
    files.set(`${entry.part}/${entry.slug}`, file);
    part.chapters.push({
      part: entry.part,
      slug: entry.slug,
      number: entry.number,
      label: part.prefix ? `${part.prefix} ${entry.number}` : null,
      title: file.frontmatter.title,
      summary: file.frontmatter.summary,
      href: `/${entry.part}/${entry.slug}`,
      access: file.frontmatter.access,
      status: file.frontmatter.status,
      estReadMinutes: file.frontmatter.estReadMinutes,
      difficulty: file.frontmatter.difficulty,
    });
  }
  bookCache = { parts, files };
  return bookCache;
}

export function getBook(): NavPart[] {
  return load().parts;
}

export function getPart(code: string): NavPart | undefined {
  return load().parts.find((p) => p.code === code);
}

export function getChapter(part: string, slug: string) {
  const { parts, files } = load();
  const file = files.get(`${part}/${slug}`);
  if (!file) return null;
  const navPart = parts.find((p) => p.code === part)!;
  const nav = navPart.chapters.find((c) => c.slug === slug)!;
  const linear = parts.flatMap((p) => p.chapters.filter((c) => c.status === "published"));
  const i = linear.findIndex((c) => c.part === part && c.slug === slug);
  return {
    file,
    nav,
    part: navPart,
    prev: i > 0 ? linear[i - 1] : null,
    next: i >= 0 && i < linear.length - 1 ? linear[i + 1] : null,
  };
}

export function allChapterParams() {
  return getBook().flatMap((p) => p.chapters.map((c) => ({ part: p.code, chapter: c.slug })));
}

let questionIndex: Map<string, QuestionYaml & { passageBody?: string; passageTitle?: string }> | null = null;

/** Question text straight from YAML (used for static rendering; answers are never sent to the client). */
export function getContentQuestion(id: string) {
  if (!questionIndex || process.env.NODE_ENV !== "production") {
    questionIndex = new Map();
    for (const f of readQuestionFiles()) {
      for (const q of f.data.questions) {
        const passage = q.passage ? f.data.passages.find((p) => p.id === q.passage) : undefined;
        questionIndex.set(q.id, { ...q, passageBody: passage?.body, passageTitle: passage?.title });
      }
    }
  }
  return questionIndex.get(id) ?? null;
}

/** Topics + count of the end-of-chapter quiz, from content YAML (static). */
export function getChapterQuizInfo(part: string, slug: string) {
  const file = readQuestionFiles().find((f) => f.part === part && (f.data.chapter ?? f.slug) === slug);
  const quiz = file?.data.questions.filter((q) => q.usage === "quiz") ?? [];
  return { count: quiz.length, topics: [...new Set(quiz.map((q) => q.topic))] };
}

// ---------------------------------------------------------------------------
// Live overrides from the DB (admin toggles), cached and invalidated by tag.
// Files describe the book; the Chapter table decides free/paid, published, early access.
// ---------------------------------------------------------------------------

export const CHAPTERS_TAG = "chapters";

interface Override {
  access: "free" | "premium";
  status: "draft" | "coming-soon" | "published";
  earlyAccessUntil: string | null;
}

async function getChapterOverrides(): Promise<Record<string, Override>> {
  "use cache";
  cacheTag(CHAPTERS_TAG);
  // Hours, not "max": if the DB was unreachable (e.g. during a build), this heals on its own.
  cacheLife("hours");
  try {
    const rows = await db.chapter.findMany({ select: { slug: true, access: true, status: true, earlyAccessUntil: true } });
    return Object.fromEntries(
      rows.map((r) => [
        r.slug,
        {
          access: r.access === "FREE" ? "free" : "premium",
          status: r.status === "PUBLISHED" ? "published" : r.status === "DRAFT" ? "draft" : "coming-soon",
          earlyAccessUntil: r.earlyAccessUntil?.toISOString() ?? null,
        } satisfies Override,
      ]),
    );
  } catch (err) {
    console.warn("[book] chapter overrides unavailable, using frontmatter", (err as Error).message);
    return {};
  }
}

/** The book with admin overrides applied. Use this for anything a reader sees. */
export async function getLiveBook(): Promise<NavPart[]> {
  const overrides = await getChapterOverrides();
  return getBook().map((p) => ({
    ...p,
    chapters: p.chapters.map((c) => {
      const o = overrides[c.slug];
      if (!o) return c;
      const early = o.earlyAccessUntil && new Date(o.earlyAccessUntil) > new Date() ? true : false;
      return { ...c, access: early ? "premium" : o.access, status: o.status };
    }),
  }));
}

export async function getLiveChapter(part: string, slug: string) {
  const base = getChapter(part, slug);
  if (!base) return null;
  const book = await getLiveBook();
  const navPart = book.find((p) => p.code === part)!;
  const nav = navPart.chapters.find((c) => c.slug === slug)!;
  const linear = book.flatMap((p) => p.chapters.filter((c) => c.status === "published"));
  const i = linear.findIndex((c) => c.part === part && c.slug === slug);
  return {
    file: base.file,
    nav,
    part: navPart,
    prev: i > 0 ? linear[i - 1] : null,
    next: i >= 0 && i < linear.length - 1 ? linear[i + 1] : null,
  };
}
