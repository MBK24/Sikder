import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "My progress" };

export default function Page() {
  return <ComingNext title="My progress">Accuracy by topic, time per question, your study streak and readiness estimates will appear here. Your answers are already being saved.</ComingNext>;
}
