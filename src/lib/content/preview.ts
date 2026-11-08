import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root } from "mdast";

/** Share of the chapter (by words) shown free before the paywall, rounded up to the next H2. */
export const PREVIEW_FRACTION = 0.2;

export interface PreviewSplit {
  /** MDX source shown to everyone (intro + first section(s)). */
  preview: string;
  /** MDX source for subscribers. Empty if the chapter has no gate point. */
  rest: string;
  /** Number of H2 sections inside the preview (numbering continues from here). */
  previewH2Count: number;
  /** Heading slugs already used in the preview, so slugs in `rest` stay unique. */
  previewSlugs: string[];
  /** Anchor of the first gated heading. */
  gateAnchor: string | null;
}

function parse(body: string) {
  return unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkMath).parse(body) as Root;
}

/**
 * Splits a chapter at the first H2 that starts after PREVIEW_FRACTION of its words
 * (or before the H2 whose anchor is `previewEndsBefore`). Always keeps at least the
 * intro and the first section free.
 */
export function splitForPreview(body: string, previewEndsBefore?: string): PreviewSplit {
  const tree = parse(body);
  const slugger = new GithubSlugger();
  const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const total = tree.children.reduce((n, c) => n + words(mdastToString(c)), 0);
  const h2s: { offset: number; slug: string; wordsBefore: number; index: number }[] = [];
  let running = 0;
  const allSlugs: string[] = [];
  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const slug = slugger.slug(mdastToString(node));
      allSlugs.push(slug);
      if (node.depth === 2 && node.position) h2s.push({ offset: node.position.start.offset!, slug, wordsBefore: running, index: allSlugs.length - 1 });
    }
    running += words(mdastToString(node));
  }

  let cut = previewEndsBefore ? h2s.find((h) => h.slug === previewEndsBefore) : undefined;
  if (!cut) {
    // First H2 after the threshold, but never before the second section.
    cut = h2s.slice(1).find((h) => h.wordsBefore >= total * PREVIEW_FRACTION) ?? h2s[h2s.length - 1];
  }
  // An explicit previewEndsBefore may gate from the very first section (e.g. reference tables);
  // automatic cuts always leave at least one section free.
  if (!cut || (h2s.indexOf(cut) === 0 && cut.slug !== previewEndsBefore)) {
    return { preview: body, rest: "", previewH2Count: h2s.length, previewSlugs: allSlugs, gateAnchor: null };
  }
  return {
    preview: body.slice(0, cut.offset),
    rest: body.slice(cut.offset),
    previewH2Count: h2s.indexOf(cut),
    previewSlugs: allSlugs.slice(0, cut.index),
    gateAnchor: cut.slug,
  };
}
