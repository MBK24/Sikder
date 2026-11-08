"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState } from "react";
import clsx from "clsx";
import type { NavPart } from "@/server/content/book";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserMenu } from "@/components/ui/UserMenu";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { useSession } from "@/lib/auth-client";

const ProgressContext = createContext<{ completed: Set<string>; setCompleted: (key: string, done: boolean) => void }>({
  completed: new Set(),
  setCompleted: () => {},
});
export const useBookProgress = () => useContext(ProgressContext);

const TOP_NAV = [
  { href: "/", label: "Book", match: (p: string) => /^\/($|(getting-started|cp|cars|bb|ps|appendix)(\/|$))/.test(p) },
  { href: "/practice", label: "Practice", match: (p: string) => p.startsWith("/practice") },
  { href: "/flashcards", label: "Flashcards", match: (p: string) => p.startsWith("/flashcards") },
  { href: "/forum", label: "Forum", match: (p: string) => p.startsWith("/forum") },
  { href: "/pricing", label: "Pricing", match: (p: string) => p.startsWith("/pricing") },
];

export function BookShell({
  nav,
  siteName,
  showSidebar = true,
  children,
}: {
  nav: NavPart[];
  siteName: string;
  /** App pages (practice, forum, account) hide the chapter rail on desktop; it stays in the mobile drawer. */
  showSidebar?: boolean;
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [completed, setCompletedState] = useState<Set<string>>(new Set());
  const { data: session } = useSession();

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/me/progress")
      .then((r) => (r.ok ? r.json() : { completed: [] }))
      .then((d: { completed: string[] }) => !cancelled && setCompletedState(new Set(d.completed)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const shownCompleted = userId ? completed : new Set<string>();

  const setCompleted = (key: string, done: boolean) =>
    setCompletedState((s) => {
      const n = new Set(s);
      if (done) n.add(key);
      else n.delete(key);
      return n;
    });

  return (
    <ProgressContext.Provider value={{ completed: shownCompleted, setCompleted }}>
      <header className="no-print sticky top-0 z-40 border-b border-[var(--c-border)] bg-[var(--c-bg)]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            type="button"
            className={clsx("icon-btn", showSidebar ? "lg:hidden" : "md:hidden")}
            aria-label="Open table of contents"
            aria-expanded={drawer}
            aria-controls="book-sidebar"
            onClick={() => setDrawer(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="mr-3 truncate font-serif text-lg font-semibold tracking-tight">
            {siteName}
          </Link>
          <Suspense fallback={<TopNav pathname="" />}>
            <ActiveTopNav />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/search" className="icon-btn" aria-label="Search">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </Link>
            <ThemeToggle />
            <NotificationBell />
            <div className="ml-1">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        {showSidebar ? (
          <aside
            className="no-print sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[290px] shrink-0 overflow-y-auto border-r border-[var(--c-border)] bg-[var(--c-bg-sidebar)] lg:block"
            aria-label="Book contents"
          >
            <Suspense fallback={<SidebarNav nav={nav} pathname="" completed={shownCompleted} />}>
              <ActiveSidebarNav nav={nav} completed={shownCompleted} />
            </Suspense>
          </aside>
        ) : null}

        {/* Mobile drawer */}
        {drawer ? (
          <div className={clsx("fixed inset-0 z-50", showSidebar ? "lg:hidden" : "md:hidden")} role="dialog" aria-modal="true" aria-label="Book contents">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <aside
              id="book-sidebar"
              className="absolute inset-y-0 left-0 w-[86vw] max-w-[320px] overflow-y-auto bg-[var(--c-bg-sidebar)] shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
                <span className="font-serif font-semibold">{siteName}</span>
                <button type="button" className="icon-btn" aria-label="Close table of contents" onClick={() => setDrawer(false)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <nav aria-label="Main" className="flex flex-wrap gap-1 border-b border-[var(--c-border)] px-3 py-2 text-sm md:hidden">
                {TOP_NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded px-2 py-1 font-medium text-muted hover:text-[var(--c-fg)]">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Suspense fallback={<SidebarNav nav={nav} pathname="" completed={shownCompleted} />}>
                <ActiveSidebarNav nav={nav} completed={shownCompleted} />
              </Suspense>
            </aside>
          </div>
        ) : null}
        <Suspense>
          <CloseOnNavigate onNavigate={() => setDrawer(false)} />
        </Suspense>

        <div id="main" className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </ProgressContext.Provider>
  );
}

/** Closes the mobile drawer when the route changes. */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const [last, setLast] = useState(pathname);
  if (last !== pathname) {
    setLast(pathname);
    onNavigate();
  }
  return null;
}

function ActiveTopNav() {
  return <TopNav pathname={usePathname()} />;
}

function TopNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
      {TOP_NAV.map((item) => {
        const active = pathname !== "" && item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded px-2.5 py-1.5 font-medium transition-colors",
              active ? "text-[var(--c-accent)]" : "text-muted hover:text-[var(--c-fg)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveSidebarNav({ nav, completed }: { nav: NavPart[]; completed: Set<string> }) {
  return <SidebarNav nav={nav} pathname={usePathname()} completed={completed} />;
}

function SidebarNav({ nav, pathname, completed }: { nav: NavPart[]; pathname: string; completed: Set<string> }) {
  return (
    <nav className="px-3 py-5 font-sans text-[0.92rem]" aria-label="Chapters">
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={clsx("sidebar-link mb-3", pathname === "/" && "is-active")}
      >
        Welcome
      </Link>
      {nav.map((part) => (
        <SidebarPart key={part.code} part={part} pathname={pathname} completed={completed} />
      ))}
    </nav>
  );
}

function SidebarPart({ part, pathname, completed }: { part: NavPart; pathname: string; completed: Set<string> }) {
  const containsActive = pathname === part.href || pathname.startsWith(`${part.href}/`);
  const [open, setOpen] = useState(true);
  const expanded = open || containsActive;
  const id = `part-${part.code}`;
  return (
    <div className="mb-3">
      <div className="flex items-center">
        <Link
          href={part.href}
          className={clsx(
            "flex-1 rounded px-2 py-1.5 text-[0.8rem] font-bold uppercase tracking-wide",
            pathname === part.href ? "text-[var(--c-accent)]" : "text-muted hover:text-[var(--c-fg)]",
          )}
        >
          {part.label !== part.title ? `${part.label} · ` : ""}
          {part.short === "Start" || part.short === "Ref" ? part.title : part.short}
        </Link>
        <button
          type="button"
          className="icon-btn !h-7 !w-7"
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${part.title}`}
          onClick={() => setOpen((o) => !o)}
          disabled={containsActive}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={clsx("transition-transform", expanded && "rotate-90")}>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {expanded ? (
        <ul id={id} className="mt-0.5 space-y-px">
          {part.chapters
            .filter((c) => c.status !== "draft")
            .map((c) => {
              const active = pathname === c.href || pathname.startsWith(`${c.href}/`);
              const done = completed.has(`${c.part}/${c.slug}`);
              return (
                <li key={c.slug}>
                  <Link href={c.href} aria-current={active ? "page" : undefined} className={clsx("sidebar-link", active && "is-active")}>
                    {c.label ? <span className="sidebar-num">{c.number}</span> : null}
                    <span className="flex-1">{c.title}</span>
                    {done ? (
                      <svg viewBox="0 0 24 24" width="15" height="15" className="mt-0.5 shrink-0 text-[var(--c-ok)]" aria-label="Completed" role="img">
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : c.access === "premium" ? (
                      <span className="sidebar-lock" title="Premium chapter" aria-label="Premium">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 118 0v3" />
                        </svg>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          {part.comingSoon.map((c, i) => (
            <li key={c.title} className="sidebar-link is-soon">
              {part.prefix ? <span className="sidebar-num">{part.chapters.length + i + 1}</span> : null}
              <span className="flex-1">{c.title}</span>
              <span className="text-[0.68rem] font-semibold uppercase tracking-wide">Soon</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
