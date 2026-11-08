"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { TocEntry } from "@/lib/content/mdx-plugins";

/** Right-hand "On this page" list with scroll-spy. */
export function Toc({ toc, variant = "rail" }: { toc: TocEntry[]; variant?: "rail" | "inline" }) {
  const [active, setActive] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    const headings = toc.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;
    const onScroll = () => {
      // Active = last heading whose top has passed 30% of the viewport.
      const line = window.innerHeight * 0.3;
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top - line <= 0) current = h.id;
        else break;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  if (!toc.length) return null;

  // Like r4ds: show H3s only under the H2 that contains the active section.
  const activeIndex = toc.findIndex((t) => t.id === active);
  let activeH2 = -1;
  for (let i = activeIndex; i >= 0; i--) {
    if (toc[i].depth === 2) {
      activeH2 = i;
      break;
    }
  }
  const visible = toc.filter((t, i) => {
    if (variant === "inline" || t.depth === 2) return true;
    let parent = i;
    while (parent >= 0 && toc[parent].depth !== 2) parent--;
    return parent === activeH2;
  });

  const list = (
    <ul className="space-y-0.5">
      {visible.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            aria-current={active === t.id ? "location" : undefined}
            className={clsx(
              "toc-link",
              t.depth === 3 && "pl-5",
              active === t.id ? "is-active" : "",
            )}
          >
            {t.number ? <span className="mr-1.5 tabular-nums opacity-80">{t.number}</span> : null}
            {t.title}
          </a>
        </li>
      ))}
    </ul>
  );

  if (variant === "inline") {
    return (
      <details className="toc-inline mb-8 rounded-md border border-[var(--c-border)] px-4 py-2 font-sans text-sm xl:hidden">
        <summary className="cursor-pointer py-1 font-semibold">On this page</summary>
        <nav aria-label="On this page" className="pb-2 pt-1">
          {list}
        </nav>
      </details>
    );
  }
  return (
    <nav aria-label="On this page" className="font-sans text-[0.85rem]">
      <p className="mb-2 font-semibold">On this page</p>
      {list}
    </nav>
  );
}
