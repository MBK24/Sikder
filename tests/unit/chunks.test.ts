import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import { toHtml } from "hast-util-to-html";
import type { Root } from "hast";
import { rehypeHtmlChunks, rehypeKatexMhchem, remarkSectionHeadings } from "@/lib/content/mdx-plugins";

function run(md: string) {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkSectionHeadings, { chapterNumber: 3 })
    .use(remarkRehype)
    .use(rehypeKatexMhchem)
    .use(rehypeHtmlChunks, (nodes: unknown[]) => toHtml({ type: "root", children: nodes } as Root));
  return p.runSync(p.parse(md)) as unknown as { children: { type: string; name?: string; attributes?: { value: string }[] }[] };
}

describe("rehypeHtmlChunks", () => {
  it("collapses plain content into one HTML chunk with numbered, anchored headings", () => {
    const tree = run("Intro with $K_a$.\n\n## Buffers\n\nText.\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    expect(tree.children).toHaveLength(1);
    const html = tree.children[0].attributes![0].value;
    expect(tree.children[0].name).toBe("HtmlChunk");
    expect(html).toContain('<span class="header-section-number">3.1</span>');
    expect(html).toContain('href="#buffers"');
    expect(html).toContain('class="table-wrap"');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("data-number");
  });
});
