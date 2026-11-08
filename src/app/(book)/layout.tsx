import { BookShell } from "@/components/book/BookShell";
import { getBook } from "@/server/content/book";
import { siteConfig } from "@/config/site";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookShell nav={getBook()} siteName={siteConfig.name}>
      {children}
    </BookShell>
  );
}
