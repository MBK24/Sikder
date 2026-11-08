import "server-only";
import { evaluate } from "next-mdx-remote-client/rsc";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeKatexMhchem, remarkSectionHeadings, type HeadingOptions, type TocEntry } from "@/lib/content/mdx-plugins";
import { splitForPreview, type PreviewSplit } from "@/lib/content/preview";
import type { ChapterFile } from "@/lib/content/files";
import { Callout } from "@/components/mdx/Callout";
import { Figure } from "@/components/mdx/Figure";
import { Question } from "@/components/mdx/Question";
import { H2, H3 } from "@/components/mdx/Headings";

const components = {
  Callout,
  Figure,
  Question,
  h2: H2,
  h3: H3,
  table: (props: React.ComponentProps<"table">) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
};

/** Compiles an MDX fragment on the server, continuing section numbering from `headings`. */
export async function renderMdx(source: string, headings: Omit<HeadingOptions, "onToc">) {
  let toc: TocEntry[] = [];
  const { content, error } = await evaluate({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkMath, [remarkSectionHeadings, { ...headings, onToc: (t: TocEntry[]) => (toc = t) }]],
        rehypePlugins: [rehypeKatexMhchem],
      },
    },
    components,
  });
  if (error) throw error;
  return { content, toc };
}

/** Whole-chapter table of contents without rendering (headings are public even when gated). */
export function extractToc(body: string, chapterNumber?: number): TocEntry[] {
  let toc: TocEntry[] = [];
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkMath).use(remarkSectionHeadings, { chapterNumber, onToc: (t) => (toc = t) });
  processor.runSync(processor.parse(body));
  return toc;
}

const splits = new Map<string, PreviewSplit>();

/** Preview/rest split for a chapter (memoized per file + frontmatter). */
export function chapterSplit(file: ChapterFile): PreviewSplit {
  const key = `${file.filePath}:${file.body.length}:${file.frontmatter.previewEndsBefore ?? ""}`;
  let s = splits.get(key);
  if (!s) {
    s = splitForPreview(file.body, file.frontmatter.previewEndsBefore);
    splits.set(key, s);
  }
  return s;
}

/** Full chapter (free chapters). */
export async function renderChapter(file: ChapterFile, numbered: boolean) {
  return renderMdx(file.body, { chapterNumber: numbered ? file.number : undefined });
}
