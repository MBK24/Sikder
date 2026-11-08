/**
 * Syncs /content into the database. Idempotent; safe to run on every deploy.
 *   pnpm content:sync
 *
 * Ownership rules:
 *  - Chapter metadata (title, summary, read time, order) always follows the files.
 *  - Chapter `access` and `status` are taken from frontmatter ONLY when the chapter is
 *    first created. After that the admin toggle in the DB is authoritative.
 *  - Questions/passages with source=ADMIN are never touched. CONTENT questions that
 *    disappear from YAML are unpublished (not deleted: attempts reference them).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root, RootContent } from "mdast";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { listChapterFiles, readChapterFile, readQuestionFiles, readFlashcardFiles, readParts } from "../src/lib/content/files";
import { PART_ENUM } from "../src/lib/content/schema";
import { TOPICS, topicSlug } from "../src/lib/content/topics";
import { FREE_QBANK_QUESTIONS } from "../src/config/pricing";
import { splitForPreview } from "../src/lib/content/preview";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DIFF = { intro: "INTRO", core: "CORE", advanced: "ADVANCED" } as const;
const ACCESS = { free: "FREE", premium: "PREMIUM" } as const;
const STATUS = { draft: "DRAFT", "coming-soon": "COMING_SOON", published: "PUBLISHED" } as const;

function sectionsOf(body: string, chapterNumber: number | undefined) {
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkMath).parse(body) as Root;
  const slugger = new GithubSlugger();
  const out: { anchor: string; number: string; heading: string; text: string; order: number }[] = [];
  let intro = "";
  let current: (typeof out)[number] | null = null;
  let h2 = 0;
  let h3 = 0;
  const textOf = (n: RootContent) =>
    n.type === "mdxJsxFlowElement" && n.name === "Question" ? "" : mdastToString(n).replace(/\s+/g, " ").trim();
  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const heading = mdastToString(node);
      if (node.depth === 2) {
        h2++;
        h3 = 0;
      } else h3++;
      const number = chapterNumber === undefined ? "" : node.depth === 2 ? `${chapterNumber}.${h2}` : `${chapterNumber}.${h2}.${h3}`;
      current = { anchor: slugger.slug(heading), number, heading, text: "", order: out.length + 1 };
      out.push(current);
      continue;
    }
    const t = textOf(node);
    if (!t) continue;
    if (current) current.text += (current.text ? " " : "") + t;
    else intro += (intro ? " " : "") + t;
  }
  return { intro, sections: out };
}

async function main() {
  const started = Date.now();
  const parts = readParts();

  // Topics ------------------------------------------------------------------
  const topicIds = new Map<string, string>();
  for (const t of TOPICS) {
    const row = await db.topic.upsert({
      where: { slug: topicSlug(t.code) },
      create: { slug: topicSlug(t.code), code: t.code, part: PART_ENUM[t.part], name: t.name },
      update: { name: t.name, code: t.code, part: PART_ENUM[t.part] },
      select: { id: true },
    });
    topicIds.set(t.code, row.id);
  }

  // Chapters + sections -----------------------------------------------------
  const chapterIds = new Map<string, string>(); // slug -> id
  for (const entry of listChapterFiles()) {
    const file = readChapterFile(entry);
    const fm = file.frontmatter;
    const numbered = Boolean(parts.find((p) => p.code === entry.part)?.prefix);
    const part = PART_ENUM[entry.part];
    const shared = {
      part,
      number: entry.number,
      order: entry.number,
      title: fm.title,
      summary: fm.summary,
      estReadMinutes: fm.estReadMinutes,
      difficulty: DIFF[fm.difficulty],
    };
    // Free the (part, number) slot if another chapter used to hold it (renumbering).
    await db.chapter.updateMany({
      where: { part, number: entry.number, NOT: { slug: entry.slug } },
      data: { number: { increment: 1000 } },
    });
    const existing = await db.chapter.findUnique({ where: { slug: entry.slug }, select: { id: true } });
    const chapter = existing
      ? await db.chapter.update({ where: { id: existing.id }, data: shared, select: { id: true, access: true } })
      : await db.chapter.create({
          data: {
            ...shared,
            slug: entry.slug,
            access: ACCESS[fm.access],
            status: STATUS[fm.status],
            publishedAt: fm.status === "published" ? new Date() : null,
          },
          select: { id: true, access: true },
        });
    chapterIds.set(entry.slug, chapter.id);

    const { intro, sections } = sectionsOf(file.body, numbered ? entry.number : undefined);
    const rows = [{ anchor: "introduction", number: "", heading: fm.title, text: intro, order: 0 }, ...sections];
    // Search shows full snippets only for sections inside the free preview.
    const split = splitForPreview(file.body, fm.previewEndsBefore);
    const gateAt = split.gateAnchor ? rows.findIndex((r) => r.anchor === split.gateAnchor) : -1;
    await db.$transaction([
      db.contentSection.deleteMany({ where: { chapterId: chapter.id } }),
      db.contentSection.createMany({
        data: rows.map((s, i) => ({ ...s, chapterId: chapter.id, inPreview: chapter.access === "FREE" || gateAt === -1 || i < gateAt })),
      }),
    ]);
  }

  // Questions + passages + quizzes -----------------------------------------
  const seenQuestionKeys = new Set<string>();
  let qCount = 0;
  let skippedAdmin = 0;
  for (const f of readQuestionFiles()) {
    const part = PART_ENUM[f.part];
    const chapterId = chapterIds.get(f.data.chapter ?? f.slug) ?? null;
    const passageIds = new Map<string, string>();
    for (const p of f.data.passages) {
      const existing = await db.passage.findUnique({ where: { key: p.id }, select: { id: true, source: true } });
      if (existing?.source === "ADMIN") {
        passageIds.set(p.id, existing.id);
        continue;
      }
      const row = await db.passage.upsert({
        where: { key: p.id },
        create: { key: p.id, part, title: p.title, body: p.body, source: "CONTENT" },
        update: { part, title: p.title ?? null, body: p.body },
        select: { id: true },
      });
      passageIds.set(p.id, row.id);
    }
    const quizIds: string[] = [];
    const passageOrder = new Map<string, number>();
    for (const q of f.data.questions) {
      seenQuestionKeys.add(q.id);
      const existing = await db.question.findUnique({ where: { key: q.id }, select: { id: true, source: true } });
      if (existing?.source === "ADMIN") {
        skippedAdmin++;
        if (q.usage === "quiz") quizIds.push(existing.id);
        continue;
      }
      const pOrder = q.passage ? (passageOrder.get(q.passage) ?? 0) + 1 : null;
      if (q.passage) passageOrder.set(q.passage, pOrder!);
      const data = {
        part,
        topicId: topicIds.get(q.topic) ?? null,
        chapterId,
        passageId: q.passage ? (passageIds.get(q.passage) ?? null) : null,
        passageOrder: pOrder,
        difficulty: DIFF[q.difficulty],
        stem: q.stem,
        choices: (["A", "B", "C", "D"] as const).map((id) => ({
          id,
          text: q.choices[id],
          ...(q.whyWrong?.[id] ? { explanation: q.whyWrong[id] } : {}),
        })) as Prisma.InputJsonValue,
        correct: q.answer,
        explanation: q.explanation,
        inBank: q.usage !== "inline",
        published: true,
      };
      const row = await db.question.upsert({
        where: { key: q.id },
        create: { key: q.id, source: "CONTENT", ...data },
        update: data,
        select: { id: true },
      });
      if (q.usage === "quiz") quizIds.push(row.id);
      qCount++;
    }
    if (chapterId) {
      await db.$transaction([
        db.chapterQuizItem.deleteMany({ where: { chapterId } }),
        db.chapterQuizItem.createMany({ data: quizIds.map((questionId, i) => ({ chapterId, questionId, order: i + 1 })) }),
      ]);
    }
  }
  const unpublished = await db.question.updateMany({
    where: { source: "CONTENT", key: { notIn: [...seenQuestionKeys] }, published: true },
    data: { published: false },
  });

  // Free-tier question set -------------------------------------------------
  // Chosen once (when no question is marked free yet); admins curate it after that.
  let freeMarked = 0;
  if ((await db.question.count({ where: { isFree: true } })) === 0) {
    const perSection = await Promise.all(
      (["CP", "CARS", "BB", "PS"] as const).map((part) =>
        db.chapterQuizItem.findMany({
          where: { chapter: { part, access: "FREE" } },
          orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
          select: { questionId: true },
        }),
      ),
    );
    const picked: string[] = [];
    for (let i = 0; picked.length < FREE_QBANK_QUESTIONS && perSection.some((l) => i < l.length); i++) {
      for (const list of perSection) if (list[i] && picked.length < FREE_QBANK_QUESTIONS) picked.push(list[i].questionId);
    }
    freeMarked = (await db.question.updateMany({ where: { id: { in: picked } }, data: { isFree: true } })).count;
  }

  // Flashcards --------------------------------------------------------------
  let cardCount = 0;
  for (const f of readFlashcardFiles()) {
    const key = `deck-${f.part}-${f.slug}`;
    const deck = await db.flashcardDeck.upsert({
      where: { key },
      create: { key, kind: "BUILT_IN", title: f.data.deck.title, description: f.data.deck.description, chapterId: chapterIds.get(f.slug) ?? null },
      update: { title: f.data.deck.title, description: f.data.deck.description ?? null, chapterId: chapterIds.get(f.slug) ?? null },
      select: { id: true },
    });
    const keys = f.data.cards.map((c) => c.id);
    for (const [i, c] of f.data.cards.entries()) {
      await db.flashcard.upsert({
        where: { key: c.id },
        create: { key: c.id, deckId: deck.id, front: c.front, back: c.back, tags: c.tags, order: i + 1 },
        update: { deckId: deck.id, front: c.front, back: c.back, tags: c.tags, order: i + 1 },
      });
      cardCount++;
    }
    await db.flashcard.deleteMany({ where: { deckId: deck.id, key: { notIn: keys } } });
  }

  console.log(
    `content:sync — ${chapterIds.size} chapters, ${qCount} questions${skippedAdmin ? ` (${skippedAdmin} admin-owned skipped)` : ""}, ` +
      `${unpublished.count} unpublished, ${freeMarked ? `${freeMarked} marked free, ` : ""}${cardCount} flashcards, ${TOPICS.length} topics in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
