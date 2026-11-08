import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Practice" };

export default function Page() {
  return <ComingNext title="Practice">The question bank, timed practice sets and full-length section tests are being built. For now, every chapter has practice questions built in.</ComingNext>;
}
