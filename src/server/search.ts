import "server-only";
import { db } from "./db";
import { PART_CODES, PART_ENUM } from "@/lib/content/schema";

const ENUM_TO_CODE = Object.fromEntries(PART_CODES.map((c) => [PART_ENUM[c], c])) as Record<string, string>;

export interface BookHit {
  href: string;
  chapterTitle: string;
  heading: string;
  number: string;
  snippet: string;
  premium: boolean;
}

/** Full-text search over book sections (tsvector + websearch syntax: quotes, OR, -exclude). */
export async function searchBook(q: string, limit = 30): Promise<BookHit[]> {
  const query = q.trim().slice(0, 200);
  if (query.length < 2) return [];
  const rows = await db.$queryRaw<
    { slug: string; part: string; title: string; access: string; anchor: string; heading: string; number: string; snippet: string; inPreview: boolean }[]
  >`
    SELECT c.slug, c.part::text AS part, c.title, c.access::text AS access,
           s.anchor, s.heading, s.number, s."inPreview",
           ts_headline('english', s.text, websearch_to_tsquery('english', ${query}),
                       'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1') AS snippet
    FROM "ContentSection" s
    JOIN "Chapter" c ON c.id = s."chapterId"
    WHERE c.status = 'PUBLISHED'
      AND s."searchVector" @@ websearch_to_tsquery('english', ${query})
    ORDER BY ts_rank(s."searchVector", websearch_to_tsquery('english', ${query})) DESC
    LIMIT ${limit}`;
  return rows.map((r) => {
    const premium = r.access === "PREMIUM" && !r.inPreview;
    return {
      href: `/${ENUM_TO_CODE[r.part]}/${r.slug}${r.anchor === "introduction" ? "" : `#${r.anchor}`}`,
      chapterTitle: r.title,
      heading: r.heading,
      number: r.number,
      // Paid sections: show only the first few words of the match.
      snippet: premium ? r.snippet.split(/\s+/).slice(0, 12).join(" ") + " …" : r.snippet,
      premium,
    };
  });
}
