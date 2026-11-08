import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { NewDeckForm } from "@/components/flashcards/DeckForms";
import { Upsell } from "@/components/ui/Upsell";

export const metadata: Metadata = { title: "New deck", robots: { index: false } };

export default function NewDeckPage() {
  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">New deck</h1>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  await requireUser("/flashcards/new");
  if (!can(await getEntitlement(), "flashcards.custom")) {
    return (
      <div className="mt-6">
        <Upsell title="Your own decks are part of Premium" />
      </div>
    );
  }
  return <NewDeckForm />;
}
