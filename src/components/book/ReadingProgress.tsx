"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Thin progress bar under the header + (for signed-in readers) periodic reporting of
 * scroll depth, last section in view, and active reading time.
 */
export function ReadingProgress({ part, slug }: { part: string; slug: string }) {
  const [pct, setPct] = useState(0);
  const { data: session } = useSession();
  const state = useRef({ max: 0, anchor: null as string | null, seconds: 0, lastActive: 0 });

  useEffect(() => {
    const article = document.getElementById("chapter-body");
    if (!article) return;
    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      setPct(p);
      state.current.max = Math.max(state.current.max, p);
      state.current.lastActive = Date.now();
      const headings = article.querySelectorAll<HTMLElement>("h2[id], h3[id]");
      for (const h of headings) {
        if (h.getBoundingClientRect().top < window.innerHeight * 0.3) state.current.anchor = h.id;
        else break;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signedIn = !!session;
  useEffect(() => {
    if (!signedIn) return;
    state.current.lastActive = Date.now();
    // Count a second as "reading" if the tab is visible and the user interacted in the last 2 minutes.
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - state.current.lastActive < 120_000) state.current.seconds += 1;
    }, 1000);
    const flush = () => {
      const s = state.current;
      if (s.seconds < 5 && s.max === 0) return;
      const body = JSON.stringify({ part, slug, maxScrollPct: s.max, lastAnchor: s.anchor, seconds: s.seconds });
      s.seconds = 0;
      navigator.sendBeacon?.("/api/me/reading", new Blob([body], { type: "application/json" }));
    };
    const every = setInterval(flush, 30_000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    const onAct = () => (state.current.lastActive = Date.now());
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", onAct);
    window.addEventListener("pointermove", onAct, { passive: true });
    return () => {
      flush();
      clearInterval(tick);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", onAct);
      window.removeEventListener("pointermove", onAct);
    };
  }, [signedIn, part, slug]);

  return (
    <div
      className="no-print fixed inset-x-0 top-14 z-30 h-[3px] bg-transparent"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <div className="h-full origin-left bg-[var(--c-accent)] transition-transform duration-150" style={{ transform: `scaleX(${pct})` }} />
    </div>
  );
}
