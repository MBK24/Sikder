import type { MetadataRoute } from "next";
import { getBook } from "@/server/content/book";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const book = getBook();
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/pricing`, priority: 0.6 },
    ...book.map((p) => ({ url: `${base}${p.href}`, priority: 0.7 })),
    ...book.flatMap((p) =>
      p.chapters
        .filter((c) => c.status === "published")
        .map((c) => ({ url: `${base}${c.href}`, priority: c.access === "free" ? 0.9 : 0.6 })),
    ),
  ];
}
