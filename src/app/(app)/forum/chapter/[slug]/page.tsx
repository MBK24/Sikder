import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Discuss this chapter", robots: { index: false } };

export default function Page() {
  return (
    <ComingNext title="Discuss this chapter">
      Chapter discussions open with the forum. You&apos;ll be able to ask about any section and get answers from verified tutors.
    </ComingNext>
  );
}
