import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Flashcards" };

export default function Page() {
  return <ComingNext title="Flashcards">Spaced-repetition flashcard decks for every chapter are on the way.</ComingNext>;
}
