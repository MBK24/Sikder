import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import {
  PART_CODES,
  type PartCode,
  chapterFrontmatterSchema,
  type ChapterFrontmatter,
  questionFileSchema,
  type QuestionFile,
  flashcardFileSchema,
  type FlashcardFile,
  comingSoonSchema,
  partsFileSchema,
} from "./schema";

export const CONTENT_DIR = path.join(process.cwd(), "content");
const BOOK_DIR = path.join(CONTENT_DIR, "book");

const CHAPTER_FILE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;

export interface ChapterFile {
  part: PartCode;
  number: number;
  slug: string;
  filePath: string;
  frontmatter: ChapterFrontmatter;
  body: string;
}

export function readParts() {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "_meta", "parts.yaml"), "utf8");
  return partsFileSchema.parse(YAML.parse(raw)).parts;
}

export function listChapterFiles(): { part: PartCode; number: number; slug: string; filePath: string }[] {
  const out: { part: PartCode; number: number; slug: string; filePath: string }[] = [];
  for (const part of PART_CODES) {
    const dir = path.join(BOOK_DIR, part);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".mdx")) continue;
      const m = CHAPTER_FILE.exec(name);
      if (!m) throw new Error(`Bad chapter filename ${part}/${name}: expected NN-kebab-slug.mdx`);
      out.push({ part, number: Number(m[1]), slug: m[2], filePath: path.join(dir, name) });
    }
  }
  return out;
}

export function readChapterFile(entry: { part: PartCode; number: number; slug: string; filePath: string }): ChapterFile {
  const raw = fs.readFileSync(entry.filePath, "utf8");
  const { data, content } = matter(raw);
  const parsed = chapterFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid frontmatter in ${path.relative(process.cwd(), entry.filePath)}:\n${parsed.error.message}`);
  }
  return { ...entry, frontmatter: parsed.data, body: content };
}

export function readComingSoon(part: PartCode) {
  const file = path.join(BOOK_DIR, part, "_coming-soon.yaml");
  if (!fs.existsSync(file)) return [];
  return comingSoonSchema.parse(YAML.parse(fs.readFileSync(file, "utf8"))).chapters;
}

function readYamlDir<T>(sub: string, parse: (v: unknown) => T): { part: PartCode; slug: string; filePath: string; data: T }[] {
  const out: { part: PartCode; slug: string; filePath: string; data: T }[] = [];
  for (const part of PART_CODES) {
    const dir = path.join(CONTENT_DIR, sub, part);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".yaml")) continue;
      const filePath = path.join(dir, name);
      const raw = YAML.parse(fs.readFileSync(filePath, "utf8"));
      try {
        out.push({ part, slug: name.replace(/\.yaml$/, ""), filePath, data: parse(raw) });
      } catch (err) {
        throw new Error(`Invalid ${sub}/${part}/${name}:\n${(err as Error).message}`);
      }
    }
  }
  return out;
}

export function readQuestionFiles() {
  return readYamlDir<QuestionFile>("questions", (v) => questionFileSchema.parse(v));
}

export function readFlashcardFiles() {
  return readYamlDir<FlashcardFile>("flashcards", (v) => flashcardFileSchema.parse(v));
}
