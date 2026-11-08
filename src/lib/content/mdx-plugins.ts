import katex from "katex";
import "katex/contrib/mhchem";
import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Root as MdastRoot, Heading } from "mdast";
import type { Root as HastRoot, Element, ElementContent } from "hast";
import type { VFile } from "vfile";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";

// -----------------------------------------------------------------------------
// KaTeX (+ mhchem for \ce{...}) — server-rendered math, no client JS.
// remark-math emits <code class="language-math math-inline|math-display">.
// -----------------------------------------------------------------------------

export interface KatexOptions {
  /** Throw on the first malformed expression (used by `content:check`). */
  strict?: boolean;
}

function textOf(node: Element): string {
  let out = "";
  visit(node, "text", (t: { value: string }) => {
    out += t.value;
  });
  return out;
}

export function rehypeKatexMhchem(options: KatexOptions = {}) {
  return (tree: HastRoot, file: VFile) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "code" || !parent || index === undefined) return;
      const classes = (node.properties?.className as string[] | undefined) ?? [];
      const inline = classes.includes("math-inline");
      const display = classes.includes("math-display");
      if (!inline && !display) return;

      const tex = textOf(node);
      let html: string;
      try {
        html = katex.renderToString(tex, {
          displayMode: display,
          throwOnError: true,
          strict: "ignore",
          output: "htmlAndMathml",
          trust: false,
        });
      } catch (err) {
        const msg = `KaTeX error in \`${tex}\`: ${(err as Error).message}`;
        // In strict mode content:check treats any KaTeX message as an error.
        file.message(msg, node);
        html = `<span class="katex-error" title="${msg.replace(/"/g, "&quot;")}">${tex}</span>`;
      }

      const replacement: Element = {
        type: "element",
        tagName: display ? "div" : "span",
        properties: { className: [display ? "math-display" : "math-inline"] },
        children: fromHtmlIsomorphic(html, { fragment: true }).children as ElementContent[],
      };

      // display math is wrapped in <pre><code>; replace the <pre>
      if (display && parent.type === "element" && (parent as Element).tagName === "pre") {
        const p = parent as Element;
        p.tagName = "div";
        p.properties = { className: ["math-display"] };
        p.children = replacement.children;
        return;
      }
      (parent.children as ElementContent[])[index] = replacement;
    });
  };
}

// -----------------------------------------------------------------------------
// Headings: stable slug ids + section numbers ("2.3", "2.3.1") + TOC extraction.
// Runs on mdast so the TOC is available before rendering.
// -----------------------------------------------------------------------------

export interface TocEntry {
  depth: 2 | 3;
  id: string;
  number: string;
  title: string;
}

export interface HeadingOptions {
  /** Chapter number, e.g. 2. Omit for unnumbered parts (Getting Started, Appendix). */
  chapterNumber?: number;
  /** Receives the table of contents as a side-channel. */
  onToc?: (toc: TocEntry[]) => void;
}

export function remarkSectionHeadings(options: HeadingOptions = {}) {
  return (tree: MdastRoot) => {
    const slugger = new GithubSlugger();
    const toc: TocEntry[] = [];
    let h2 = 0;
    let h3 = 0;
    visit(tree, "heading", (node: Heading) => {
      if (node.depth !== 2 && node.depth !== 3) return;
      const title = mdastToString(node);
      const id = slugger.slug(title);
      if (node.depth === 2) {
        h2 += 1;
        h3 = 0;
      } else {
        h3 += 1;
      }
      const number =
        options.chapterNumber === undefined
          ? ""
          : node.depth === 2
            ? `${options.chapterNumber}.${h2}`
            : `${options.chapterNumber}.${h2}.${h3}`;
      toc.push({ depth: node.depth, id, number, title });
      node.data = {
        ...node.data,
        hProperties: { ...(node.data?.hProperties ?? {}), id, "data-number": number || undefined },
      };
    });
    options.onToc?.(toc);
  };
}

/** Collects every JSX component used (name + string attributes) for validation. */
export interface JsxUsage {
  name: string | null;
  attributes: Record<string, string | true | null>;
  line?: number;
}

export function remarkCollectJsx(onCollect: (usages: JsxUsage[]) => void) {
  return (tree: MdastRoot, file: VFile) => {
    const usages: JsxUsage[] = [];
    visit(tree, (node) => {
      if (node.type === "mdxjsEsm") file.message("import/export statements are not allowed in content", node);
      if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression")
        file.message("{expressions} are not allowed in content; put braces inside $math$ or `code`", node);
      if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;
      const n = node as unknown as {
        name: string | null;
        attributes: { type: string; name: string; value: unknown }[];
        position?: { start: { line: number } };
      };
      const attributes: JsxUsage["attributes"] = {};
      for (const a of n.attributes) {
        if (a.type !== "mdxJsxAttribute") continue;
        attributes[a.name] = typeof a.value === "string" ? a.value : a.value === null ? true : null;
      }
      usages.push({ name: n.name, attributes, line: n.position?.start.line });
    });
    onCollect(usages);
  };
}
