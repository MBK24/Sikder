import "server-only";
import { evaluate } from "next-mdx-remote-client/rsc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeKatexMhchem, remarkSectionHeadings, type TocEntry } from "@/lib/content/mdx-plugins";
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

/** Compiles a chapter's MDX on the server. Pages call this at build time (static). */
export async function renderChapter(file: ChapterFile, numbered: boolean) {
  let toc: TocEntry[] = [];
  const { content, error } = await evaluate({
    source: file.body,
    options: {
      mdxOptions: {
        remarkPlugins: [
          remarkGfm,
          remarkMath,
          [remarkSectionHeadings, { chapterNumber: numbered ? file.number : undefined, onToc: (t: TocEntry[]) => (toc = t) }],
        ],
        rehypePlugins: [rehypeKatexMhchem],
      },
    },
    components,
  });
  if (error) throw error;
  return { content, toc };
}
