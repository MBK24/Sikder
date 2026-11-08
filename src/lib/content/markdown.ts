import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root as HastRoot, Element } from "hast";
import { rehypeKatexMhchem } from "./mdx-plugins";

/** Hosts user images may load from: our Vercel Blob store (+ any extra hosts in NEXT_PUBLIC_UPLOAD_HOSTS). */
function allowedImageHost(src: string) {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    const extra = (process.env.NEXT_PUBLIC_UPLOAD_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    return u.hostname.endsWith(".public.blob.vercel-storage.com") || extra.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Replaces images from other hosts with their alt text, and makes links safe to open. */
function rehypeUserContentPolicy() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName === "img") {
        const src = String(node.properties?.src ?? "");
        if (!allowedImageHost(src) && parent && index !== undefined) {
          parent.children[index] = { type: "text", value: `[image: ${String(node.properties?.alt ?? "external image")}]` };
        } else {
          node.properties = { ...node.properties, loading: "lazy", decoding: "async" };
        }
      }
      if (node.tagName === "a") {
        node.properties = { ...node.properties, rel: ["nofollow", "ugc", "noopener", "noreferrer"], target: "_blank" };
      }
    });
  };
}

/**
 * Sanitization schema for user-generated Markdown (forum, profiles).
 * Math is kept as the remark-math <code class="math-*"> placeholder and only
 * turned into KaTeX *after* sanitizing, so no user HTML ever survives.
 */
const userSchema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "user-content-",
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]] as NonNullable<SanitizeSchema["attributes"]>[string],
    img: ["src", "alt", "title"],
    a: ["href", "title"],
  },
  protocols: { ...defaultSchema.protocols, href: ["http", "https", "mailto"], src: ["https"] },
};

/** Trusted content (our own YAML question text, flashcards). */
const trusted = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatexMhchem)
  .use(rehypeStringify);

/** Untrusted user Markdown: no raw HTML, sanitized before math rendering. */
const untrusted = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype) // raw HTML in Markdown is dropped (allowDangerousHtml is off)
  .use(rehypeSanitize, userSchema)
  .use(rehypeUserContentPolicy)
  .use(rehypeKatexMhchem)
  .use(rehypeStringify);

export function markdownToHtml(md: string): string {
  return String(trusted.processSync(md));
}

export function userMarkdownToHtml(md: string): string {
  return String(untrusted.processSync(md));
}

/** Inline variant: strips a single wrapping <p> (for answer choices, card fronts). */
export function inlineMarkdownToHtml(md: string): string {
  const html = markdownToHtml(md).trim();
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return m && !m[1].includes("<p>") ? m[1] : html;
}
