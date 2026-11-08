import { describe, expect, it } from "vitest";
import { splitForPreview } from "@/lib/content/preview";
import { listChapterFiles, readChapterFile } from "@/lib/content/files";

const para = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const doc = [`Intro ${para(50)}`, `## One`, para(100), `## Two`, para(100), `## Three`, para(100), `## Four`, para(100)].join("\n\n");

describe("splitForPreview", () => {
  it("cuts at the first H2 after ~20% of the words, never before section 2", () => {
    const s = splitForPreview(doc);
    expect(s.gateAnchor).toBe("two");
    expect(s.previewH2Count).toBe(1);
    expect(s.preview).toContain("## One");
    expect(s.preview).not.toContain("## Two");
    expect(s.rest.startsWith("## Two")).toBe(true);
    expect(s.preview + s.rest).toBe(doc);
  });

  it("honors an explicit previewEndsBefore anchor", () => {
    const s = splitForPreview(doc, "four");
    expect(s.gateAnchor).toBe("four");
    expect(s.previewH2Count).toBe(3);
  });

  it("does not gate a chapter with a single section", () => {
    const s = splitForPreview(`Intro\n\n## Only\n\n${para(20)}`);
    expect(s.rest).toBe("");
  });

  it("keeps most of every real premium chapter behind the gate", () => {
    for (const entry of listChapterFiles()) {
      const f = readChapterFile(entry);
      if (f.frontmatter.access !== "premium") continue;
      const s = splitForPreview(f.body, f.frontmatter.previewEndsBefore);
      const share = s.preview.length / f.body.length;
      expect(s.rest.length, entry.slug).toBeGreaterThan(0);
      expect(share, entry.slug).toBeLessThan(0.45);
    }
  });
});
