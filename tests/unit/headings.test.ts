import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkSectionHeadings, type TocEntry } from "@/lib/content/mdx-plugins";

function toc(md: string, chapterNumber?: number) {
  let out: TocEntry[] = [];
  const processor = unified().use(remarkParse).use(remarkSectionHeadings, { chapterNumber, onToc: (t) => (out = t) });
  processor.runSync(processor.parse(md));
  return out;
}

describe("remarkSectionHeadings", () => {
  it("numbers H2 and H3 within a chapter", () => {
    const t = toc("## Intro\n\n### Detail\n\n### More\n\n## Next\n\n### Sub", 2);
    expect(t.map((e) => e.number)).toEqual(["2.1", "2.1.1", "2.1.2", "2.2", "2.2.1"]);
  });

  it("leaves unnumbered parts unnumbered", () => {
    expect(toc("## A\n\n### B").map((e) => e.number)).toEqual(["", ""]);
  });

  it("creates unique GitHub-style anchors", () => {
    const t = toc("## Buffers\n\n## Buffers\n\n## The Henderson–Hasselbalch Equation", 1);
    expect(t.map((e) => e.id)).toEqual(["buffers", "buffers-1", "the-hendersonhasselbalch-equation"]);
  });
});
