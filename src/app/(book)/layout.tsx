import { BookShell } from "@/components/book/BookShell";
import { getLiveBook } from "@/server/content/book";
import { siteConfig } from "@/config/site";

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookShell nav={await getLiveBook()} siteName={siteConfig.name}>
      {children}
    </BookShell>
  );
}
