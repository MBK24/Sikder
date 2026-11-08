import { ImageResponse } from "next/og";
import { allChapterParams, getChapter } from "@/server/content/book";
import { siteConfig } from "@/config/site";

export const alt = "Chapter preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return allChapterParams();
}

/** Social preview card: book-style title page for each chapter. */
export default async function Image({ params }: { params: Promise<{ part: string; chapter: string }> }) {
  const { part, chapter } = await params;
  const c = getChapter(part, chapter);
  const label = c?.nav.label ?? c?.part.title ?? "";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#1d2125",
          padding: "72px 80px",
          borderLeft: "16px solid #1f5f8b",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#5b6570", fontFamily: "sans-serif" }}>{c?.part.title ?? siteConfig.name}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 34, color: "#1f5f8b", fontFamily: "sans-serif", fontWeight: 700 }}>{label}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 12 }}>{c?.nav.title ?? siteConfig.name}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#5b6570", marginTop: 24, lineHeight: 1.35 }}>{c?.nav.summary.slice(0, 140) ?? ""}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontFamily: "sans-serif", color: "#5b6570" }}>
          {siteConfig.name} · {c?.nav.access === "free" ? "Free chapter" : "MCAT study guide"}
        </div>
      </div>
    ),
    size,
  );
}
