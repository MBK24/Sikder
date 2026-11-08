import Link from "next/link";
import type { ReactNode } from "react";
import type { CalloutType } from "@/lib/content/schema";

const META: Record<CalloutType, { title: string; icon: ReactNode }> = {
  "high-yield": {
    title: "High-Yield",
    icon: <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z" />,
  },
  trap: {
    title: "Common Trap",
    icon: <path d="M12 3L2 21h20L12 3zm0 6v5m0 3v.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth={2} stroke="currentColor" />,
  },
  mnemonic: {
    title: "Mnemonic",
    icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0012 3z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />,
  },
  connection: {
    title: "Connection",
    icon: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />,
  },
  note: {
    title: "Note",
    icon: <path d="M12 8v.5M12 11v5M12 3a9 9 0 110 18 9 9 0 010-18z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />,
  },
};

export function Callout({
  type = "note",
  title,
  to,
  children,
}: {
  type?: CalloutType;
  title?: string;
  to?: string;
  children: ReactNode;
}) {
  const meta = META[type] ?? META.note;
  return (
    <aside className="callout not-prose" data-callout={type} aria-label={title ?? meta.title}>
      <div className="callout-header">
        <svg aria-hidden viewBox="0 0 24 24" className="callout-icon" fill="currentColor">
          {meta.icon}
        </svg>
        <span>{title ?? meta.title}</span>
        {to ? (
          <Link href={to} className="callout-link">
            Go to section →
          </Link>
        ) : null}
      </div>
      <div className="callout-body prose">{children}</div>
    </aside>
  );
}
