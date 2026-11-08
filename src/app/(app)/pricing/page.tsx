import type { Metadata } from "next";
import { ComingNext } from "@/components/ui/ComingNext";

export const metadata: Metadata = { title: "Pricing" };

export default function Page() {
  return <ComingNext title="Pricing">Plans and pricing are coming soon. Everything in Getting Started, plus the first chapter of every section, is free.</ComingNext>;
}
