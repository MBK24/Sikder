import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Forum" };

export default function Page() {
  return <ComingNext title="Forum">The Q&amp;A forum, with verified tutors, is being built.</ComingNext>;
}
