import { describe, expect, it } from "vitest";
import { inlineMarkdownToHtml, markdownToHtml, userMarkdownToHtml } from "@/lib/content/markdown";

describe("userMarkdownToHtml (untrusted input)", () => {
  it("drops raw HTML and script tags", () => {
    const html = userMarkdownToHtml('Hello <script>alert(1)</script><img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
  });

  it("removes javascript: links", () => {
    const html = userMarkdownToHtml("[click](javascript:alert(1))");
    expect(html).not.toMatch(/javascript:/i);
  });

  it("only allows images from our upload store", () => {
    expect(userMarkdownToHtml("![a](http://evil.test/x.png)")).not.toMatch(/<img/);
    expect(userMarkdownToHtml("![pixel](https://tracker.test/x.png)")).toContain("[image: pixel]");
    const ok = "https://abc123.public.blob.vercel-storage.com/forum/u/x.png";
    expect(userMarkdownToHtml(`![a](${ok})`)).toContain(`src="${ok}"`);
  });

  it("marks user links nofollow and opens them safely", () => {
    expect(userMarkdownToHtml("[x](https://example.com)")).toMatch(/rel="nofollow ugc noopener noreferrer"/);
  });

  it("still renders math after sanitizing", () => {
    const html = userMarkdownToHtml("Energy is $E = mc^2$.");
    expect(html).toContain('class="katex"');
  });

  it("renders mhchem chemistry", () => {
    expect(userMarkdownToHtml("$\\ce{H2O}$")).toContain("katex");
  });
});

describe("trusted markdown", () => {
  it("renders GFM tables", () => {
    expect(markdownToHtml("| a | b |\n|---|---|\n| 1 | 2 |")).toContain("<table>");
  });

  it("unwraps a single paragraph for inline use", () => {
    expect(inlineMarkdownToHtml("**bold** text")).toBe("<strong>bold</strong> text");
  });
});
