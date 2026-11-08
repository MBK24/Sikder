"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Gives plain <a> tags inside pre-rendered chapter HTML the same client-side navigation as <Link>. */
export function ProseLinks({ containerId }: { containerId: string }) {
  const router = useRouter();
  useEffect(() => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [containerId, router]);
  return null;
}
