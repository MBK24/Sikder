"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession } from "@/server/auth";
import { can, getEntitlement } from "@/server/entitlements";
import { bumpStudyDay } from "@/server/study-day";
import { NEW_CARD, schedule, formatInterval, type Grade } from "@/lib/srs/sm2";

const gradeSchema = z.object({
  cardId: z.string().max(40),
  grade: z.enum(["again", "hard", "good", "easy"]),
  durationMs: z.number().int().min(0).max(60 * 60_000).optional(),
});

export async function gradeCard(raw: z.input<typeof gradeSchema>) {
  const s = await getSession();
  if (!s) return { ok: false as const, reason: "signed-out" as const };
  if (!can(await getEntitlement(), "flashcards.srs")) return { ok: false as const, reason: "upgrade" as const };
  const { cardId, grade, durationMs } = gradeSchema.parse(raw);
  const userId = s.user.id;
  const card = await db.flashcard.findUnique({ where: { id: cardId }, select: { deck: { select: { kind: true, ownerId: true } } } });
  if (!card || (card.deck.kind === "USER" && card.deck.ownerId !== userId)) return { ok: false as const, reason: "not-found" as const };

  const prev = await db.flashcardReview.findUnique({ where: { userId_cardId: { userId, cardId } } });
  const state = prev ?? NEW_CARD;
  const now = new Date();
  const next = schedule(state, grade as Grade, now);
  await db.$transaction([
    db.flashcardReview.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, ...pick(next), lastReviewedAt: now },
      update: { ...pick(next), lastReviewedAt: now },
    }),
    db.flashcardReviewLog.create({
      data: {
        userId,
        cardId,
        grade: next.quality,
        prevInterval: state.intervalDays,
        newInterval: next.intervalDays,
        newEase: next.easeFactor,
        durationMs: durationMs ?? null,
        reviewedAt: now,
      },
    }),
  ]);
  await bumpStudyDay(userId, { cardsReviewed: 1 });
  return { ok: true as const, again: grade === "again", interval: formatInterval(next, now) };
}

function pick(r: ReturnType<typeof schedule>) {
  return { easeFactor: r.easeFactor, intervalDays: r.intervalDays, repetitions: r.repetitions, lapses: r.lapses, dueAt: r.dueAt };
}

/** Preview of the next interval for each grade (shown on the buttons). */
export async function previewIntervals(cardId: string) {
  const s = await getSession();
  if (!s) return null;
  const prev = await db.flashcardReview.findUnique({ where: { userId_cardId: { userId: s.user.id, cardId: z.string().max(40).parse(cardId) } } });
  const now = new Date();
  const state = prev ?? NEW_CARD;
  return Object.fromEntries((["again", "hard", "good", "easy"] as const).map((g) => [g, formatInterval(schedule(state, g, now), now)])) as Record<Grade, string>;
}

// ---------------------------------------------------------------------------
// User decks
// ---------------------------------------------------------------------------

async function requireCustomDecks() {
  const s = await getSession();
  if (!s) redirect("/sign-in?next=/flashcards");
  if (!can(await getEntitlement(), "flashcards.custom")) redirect("/pricing");
  return s.user;
}

async function ownDeck(deckId: string, userId: string) {
  const deck = await db.flashcardDeck.findFirst({ where: { id: deckId, ownerId: userId, kind: "USER" }, select: { id: true } });
  if (!deck) throw new Error("Deck not found");
  return deck;
}

export type FormState = { error?: string; ok?: boolean };

const deckSchema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional() });

export async function createDeck(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireCustomDecks();
  const parsed = deckSchema.safeParse({ title: form.get("title"), description: form.get("description") || undefined });
  if (!parsed.success) return { error: "Give your deck a title (up to 120 characters)." };
  const count = await db.flashcardDeck.count({ where: { ownerId: user.id } });
  if (count >= 200) return { error: "You've reached the 200-deck limit." };
  const deck = await db.flashcardDeck.create({ data: { kind: "USER", ownerId: user.id, ...parsed.data } });
  redirect(`/flashcards/${deck.id}/edit`);
}

const cardSchema = z.object({ front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(4000) });

export async function addCard(deckId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireCustomDecks();
  await ownDeck(deckId, user.id);
  const parsed = cardSchema.safeParse({ front: form.get("front"), back: form.get("back") });
  if (!parsed.success) return { error: "Both sides need text (front up to 2,000 characters, back up to 4,000)." };
  const count = await db.flashcard.count({ where: { deckId } });
  if (count >= 2000) return { error: "This deck has reached 2,000 cards." };
  await db.flashcard.create({ data: { deckId, ...parsed.data, order: count + 1 } });
  revalidatePath(`/flashcards/${deckId}/edit`);
  return { ok: true };
}

export async function deleteCard(deckId: string, cardId: string) {
  const user = await requireCustomDecks();
  await ownDeck(deckId, user.id);
  await db.flashcard.deleteMany({ where: { id: cardId, deckId } });
  revalidatePath(`/flashcards/${deckId}/edit`);
}

export async function deleteDeck(deckId: string) {
  const user = await requireCustomDecks();
  await ownDeck(deckId, user.id);
  await db.flashcardDeck.delete({ where: { id: deckId } });
  redirect("/flashcards");
}
