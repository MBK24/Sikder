/**
 * Validates everything under /content. Run: `pnpm content:check`
 *  - frontmatter / YAML schemas
 *  - every MDX file compiles (with KaTeX in strict mode)
 *  - only allowed components, valid Callout types, no H1/H4+
 *  - every <Question id> exists and is an `inline` question
 *  - question / flashcard / passage ids are globally unique and their Markdown + math compiles
 * Exits non-zero on any error. Pass a path fragment to limit checks: `pnpm content:check cp/02`
 */
import path from "node:path";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import type { Root, Heading } from "mdast";
import {
  listChapterFiles,
  readChapterFile,
  readQuestionFiles,
  readFlashcardFiles,
  readParts,
  readComingSoon,
} from "../src/lib/content/files";
import { ALLOWED_COMPONENTS, CALLOUT_TYPES, PART_CODES } from "../src/lib/content/schema";
import { rehypeKatexMhchem, remarkCollectJsx, remarkSectionHeadings, type JsxUsage } from "../src/lib/content/mdx-plugins";

const filter = process.argv[2];
const errors: string[] = [];
const warnings: string[] = [];
const rel = (p: string) => path.relative(process.cwd(), p);

function remarkHeadingRules(onBad: (msg: string) => void) {
  return (tree: Root) => {
    visit(tree, "heading", (h: Heading) => {
      if (h.depth === 1) onBad(`line ${h.position?.start.line}: H1 is not allowed (the title comes from frontmatter)`);
      if (h.depth > 3) onBad(`line ${h.position?.start.line}: H${h.depth} is too deep — use H2/H3 only`);
    });
  };
}

async function compileMarkdown(source: string, where: string, format: "md" | "mdx") {
  let usages: JsxUsage[] = [];
  const bad: string[] = [];
  try {
    const file = await compile(source, {
      format,
      remarkPlugins: [
        remarkGfm,
        remarkMath,
        [remarkSectionHeadings, {}],
        [remarkHeadingRules, (m: string) => bad.push(m)],
        [remarkCollectJsx, (u: JsxUsage[]) => (usages = u)],
      ],
      rehypePlugins: [[rehypeKatexMhchem, { strict: true }]],
    });
    for (const m of file.messages) {
      if (m.fatal || /not allowed|KaTeX/.test(m.reason)) errors.push(`${where}:${m.line ?? "?"} ${m.reason}`);
    }
  } catch (err) {
    const e = err as { message: string; line?: number; place?: { line?: number } };
    errors.push(`${where}:${e.line ?? e.place?.line ?? "?"} ${e.message}`);
  }
  for (const m of bad) errors.push(`${where} ${m}`);
  return usages;
}

async function main() {
  // Parts
  let partsOk = true;
  try {
    const parts = readParts();
    for (const code of PART_CODES) if (!parts.find((p) => p.code === code)) errors.push(`parts.yaml: missing part "${code}"`);
  } catch (err) {
    partsOk = false;
    errors.push(`content/_meta/parts.yaml: ${(err as Error).message}`);
  }
  for (const code of PART_CODES) {
    try {
      readComingSoon(code);
    } catch (err) {
      errors.push(`content/book/${code}/_coming-soon.yaml: ${(err as Error).message}`);
    }
  }

  // Questions
  const questionIds = new Map<string, { usage: string; file: string; chapter?: string }>();
  const passageIds = new Set<string>();
  let qFiles: ReturnType<typeof readQuestionFiles> = [];
  try {
    qFiles = readQuestionFiles();
  } catch (err) {
    errors.push((err as Error).message);
  }
  for (const f of qFiles) {
    const where = rel(f.filePath);
    const localPassages = new Set(f.data.passages.map((p) => p.id));
    for (const p of f.data.passages) {
      if (passageIds.has(p.id)) errors.push(`${where}: duplicate passage id ${p.id}`);
      passageIds.add(p.id);
      if (!filter || where.includes(filter)) await compileMarkdown(p.body, `${where} passage ${p.id}`, "md");
    }
    for (const q of f.data.questions) {
      if (questionIds.has(q.id)) errors.push(`${where}: duplicate question id ${q.id} (also in ${questionIds.get(q.id)!.file})`);
      questionIds.set(q.id, { usage: q.usage, file: where, chapter: f.slug });
      if (q.passage && !localPassages.has(q.passage)) errors.push(`${where}: ${q.id} references unknown passage ${q.passage}`);
      if (filter && !where.includes(filter)) continue;
      const fields = { stem: q.stem, explanation: q.explanation, ...Object.fromEntries(Object.entries(q.choices).map(([k, v]) => [`choice ${k}`, v])) };
      for (const [k, v] of Object.entries({ ...fields, ...(q.whyWrong ?? {}) })) {
        await compileMarkdown(v, `${where} ${q.id} ${k}`, "md");
      }
      if (q.whyWrong && q.answer in q.whyWrong) warnings.push(`${where}: ${q.id} has a whyWrong entry for the correct answer`);
    }
  }

  // Flashcards
  const cardIds = new Set<string>();
  let fFiles: ReturnType<typeof readFlashcardFiles> = [];
  try {
    fFiles = readFlashcardFiles();
  } catch (err) {
    errors.push((err as Error).message);
  }
  for (const f of fFiles) {
    const where = rel(f.filePath);
    for (const c of f.data.cards) {
      if (cardIds.has(c.id)) errors.push(`${where}: duplicate flashcard id ${c.id}`);
      cardIds.add(c.id);
      if (filter && !where.includes(filter)) continue;
      await compileMarkdown(c.front, `${where} ${c.id} front`, "md");
      await compileMarkdown(c.back, `${where} ${c.id} back`, "md");
    }
  }

  // Chapters
  const seen = new Set<string>();
  const referenced = new Set<string>();
  let entries: ReturnType<typeof listChapterFiles> = [];
  try {
    entries = listChapterFiles();
  } catch (err) {
    errors.push((err as Error).message);
  }
  for (const entry of entries) {
    const where = rel(entry.filePath);
    const key = `${entry.part}/${entry.number}`;
    if (seen.has(key)) errors.push(`${where}: duplicate chapter number in part ${entry.part}`);
    seen.add(key);
    let chapter;
    try {
      chapter = readChapterFile(entry);
    } catch (err) {
      errors.push((err as Error).message);
      continue;
    }
    if (filter && !where.includes(filter)) continue;

    const usages = await compileMarkdown(chapter.body, where, "mdx");
    for (const u of usages) {
      const at = `${where}:${u.line ?? "?"}`;
      if (!u.name || !(ALLOWED_COMPONENTS as readonly string[]).includes(u.name)) {
        errors.push(`${at} <${u.name ?? "fragment"}> is not an allowed component (${ALLOWED_COMPONENTS.join(", ")})`);
        continue;
      }
      if (u.name === "Callout") {
        const t = u.attributes.type;
        if (typeof t !== "string" || !(CALLOUT_TYPES as readonly string[]).includes(t))
          errors.push(`${at} <Callout type="${String(t)}"> must be one of ${CALLOUT_TYPES.join(", ")}`);
      }
      if (u.name === "Question") {
        const id = u.attributes.id;
        if (typeof id !== "string") {
          errors.push(`${at} <Question> needs a string id`);
          continue;
        }
        referenced.add(id);
        const q = questionIds.get(id);
        if (!q) errors.push(`${at} <Question id="${id}"> not found in content/questions`);
        else if (q.usage !== "inline") errors.push(`${at} <Question id="${id}"> has usage "${q.usage}", expected "inline"`);
      }
      if (u.name === "Figure" && (typeof u.attributes.src !== "string" || typeof u.attributes.alt !== "string"))
        errors.push(`${at} <Figure> needs src and alt`);
    }

    if (chapter.frontmatter.status === "published" && ["cp", "cars", "bb", "ps"].includes(entry.part)) {
      const quiz = [...questionIds.entries()].filter(([, v]) => v.chapter === entry.slug && v.usage === "quiz").length;
      if (quiz < 10 || quiz > 15) warnings.push(`${where}: has ${quiz} quiz questions (want 10–15)`);
      if (!fFiles.find((f) => f.slug === entry.slug && f.part === entry.part)) warnings.push(`${where}: no flashcard deck`);
    }
    const words = chapter.body.split(/\s+/).length;
    if (chapter.frontmatter.status === "published") {
      const expected = Math.round(words / 200);
      if (Math.abs(expected - chapter.frontmatter.estReadMinutes) > Math.max(5, expected * 0.5))
        warnings.push(`${where}: estReadMinutes=${chapter.frontmatter.estReadMinutes} but ~${words} words ≈ ${expected} min`);
    }
  }
  for (const [id, q] of questionIds)
    if (q.usage === "inline" && !referenced.has(id) && (!filter || q.file.includes(filter)))
      warnings.push(`${q.file}: inline question ${id} is never placed with <Question id="${id}" />`);

  for (const w of warnings) console.warn(`warn  ${w}`);
  for (const e of errors) console.error(`error ${e}`);
  console.log(
    `\n${entries.length} chapters, ${questionIds.size} questions, ${passageIds.size} passages, ${cardIds.size} flashcards — ` +
      `${errors.length} error(s), ${warnings.length} warning(s)${partsOk ? "" : " (parts.yaml invalid)"}`,
  );
  process.exit(errors.length ? 1 : 0);
}

main();
