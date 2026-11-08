import { BookShell } from "@/components/book/BookShell";
import { getBook } from "@/server/content/book";
import { siteConfig } from "@/config/site";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookShell nav={getBook()} siteName={siteConfig.name} showSidebar={false}>
      {children}
    </BookShell>
  );
}
