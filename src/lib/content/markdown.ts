import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { rehypeKatexMhchem } from "./mdx-plugins";

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
