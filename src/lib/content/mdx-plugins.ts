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
  /** H2 sections that came before this fragment (for the gated part of a chapter). */
  startH2?: number;
  /** Slugs already used earlier in the chapter, so anchors stay unique across fragments. */
  seedSlugs?: string[];
  /** Receives the table of contents as a side-channel. */
  onToc?: (toc: TocEntry[]) => void;
}

export function remarkSectionHeadings(options: HeadingOptions = {}) {
  return (tree: MdastRoot) => {
    const slugger = new GithubSlugger();
    for (const s of options.seedSlugs ?? []) slugger.slug(s);
    const toc: TocEntry[] = [];
    let h2 = options.startH2 ?? 0;
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

// -----------------------------------------------------------------------------
// Static HTML chunks: the biggest performance win for long chapters.
// Runs of plain content (paragraphs, lists, tables, math, headings) are serialized
// to one HTML string each and rendered via <HtmlChunk html="…">. React then hydrates
// a handful of elements instead of thousands; only real components (Question,
// Callout, Figure) stay as React.
// -----------------------------------------------------------------------------

type AnyNode = { type: string; tagName?: string; name?: string; children?: AnyNode[]; properties?: Record<string, unknown>; value?: string };

function containsJsx(node: AnyNode): boolean {
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement" || node.type.startsWith("mdx")) return true;
  return (node.children ?? []).some(containsJsx);
}

/** Adds the section number span + anchor link to headings and wraps tables, all in hast. */
function decorate(node: AnyNode) {
  if (node.type === "element" && (node.tagName === "h2" || node.tagName === "h3")) {
    const props = node.properties ?? {};
    // hProperties pass through as-is, so the key may be "data-number" or the hast-normalized "dataNumber".
    const number = (props.dataNumber ?? props["data-number"]) as string | undefined;
    const id = props.id as string | undefined;
    node.properties = { ...props, className: ["group", "scroll-mt-24"] };
    delete (node.properties as Record<string, unknown>).dataNumber;
    delete (node.properties as Record<string, unknown>)["data-number"];
    node.children = [
      ...(number ? [{ type: "element", tagName: "span", properties: { className: ["header-section-number"] }, children: [{ type: "text", value: number }] }] : []),
      ...(node.children ?? []),
      ...(id
        ? [{ type: "element", tagName: "a", properties: { href: `#${id}`, className: ["anchor-link"], ariaLabel: "Link to this section" }, children: [{ type: "text", value: "#" }] }]
        : []),
    ];
  }
  for (const c of node.children ?? []) decorate(c);
  if (node.children) {
    node.children = node.children.map((c) =>
      c.type === "element" && c.tagName === "table"
        ? { type: "element", tagName: "div", properties: { className: ["table-wrap"] }, children: [c] }
        : c,
    );
  }
}

export function rehypeHtmlChunks(toHtml: (nodes: AnyNode[]) => string) {
  const chunk = (parent: AnyNode) => {
    const out: AnyNode[] = [];
    let run: AnyNode[] = [];
    const flush = () => {
      const meaningful = run.some((n) => !(n.type === "text" && !n.value?.trim()));
      if (meaningful) {
        out.push({
          type: "mdxJsxFlowElement",
          name: "HtmlChunk",
          attributes: [{ type: "mdxJsxAttribute", name: "html", value: toHtml(run) }],
          children: [],
        } as unknown as AnyNode);
      }
      run = [];
    };
    for (const child of parent.children ?? []) {
      if (containsJsx(child)) {
        flush();
        if (child.type === "element") chunk(child); // e.g. a <p> holding an inline component
        else if (child.type === "mdxJsxFlowElement") chunk(child); // Callout children
        out.push(child);
      } else run.push(child);
    }
    flush();
    parent.children = out;
  };
  return (tree: HastRoot) => {
    decorate(tree as unknown as AnyNode);
    chunk(tree as unknown as AnyNode);
  };
}
