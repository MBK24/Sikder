import "server-only";
import { db } from "./db";
import { markdownToHtml, userMarkdownToHtml } from "@/lib/content/markdown";
import type { Part } from "@/generated/prisma/enums";

/** Max brand-new cards introduced per review session. */
export const NEW_CARDS_PER_SESSION = 20;
const MAX_DUE_PER_SESSION = 200;

export interface DeckSummary {
  id: string;
  title: string;
  description: string | null;
  kind: "BUILT_IN" | "USER";
  part: Part | null;
  chapterTitle: string | null;
  total: number;
  due: number;
  fresh: number;
}

/** Built-in decks plus the user's own, with due/new counts for the user. */
export async function listDecks(userId: string | null): Promise<DeckSummary[]> {
  const decks = await db.flashcardDeck.findMany({
    where: { OR: [{ kind: "BUILT_IN" }, ...(userId ? [{ ownerId: userId }] : [])] },
    orderBy: [{ kind: "asc" }, { chapter: { part: "asc" } }, { chapter: { order: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      chapter: { select: { part: true, title: true } },
      _count: { select: { cards: true } },
    },
  });
  const now = new Date();
  const [due, seen] = userId
    ? await Promise.all([
        db.flashcardReview.groupBy({
          by: ["cardId"],
          where: { userId, suspended: false, dueAt: { lte: now } },
        }),
        db.flashcardReview.findMany({ where: { userId }, select: { cardId: true, card: { select: { deckId: true } } } }),
      ])
    : [[], []];
  const dueIds = new Set(due.map((d) => d.cardId));
  const seenByDeck = new Map<string, number>();
  for (const s of seen) seenByDeck.set(s.card.deckId, (seenByDeck.get(s.card.deckId) ?? 0) + 1);
  const dueByDeck = new Map<string, number>();
  if (dueIds.size) {
    const cards = await db.flashcard.findMany({ where: { id: { in: [...dueIds] } }, select: { deckId: true } });
    for (const c of cards) dueByDeck.set(c.deckId, (dueByDeck.get(c.deckId) ?? 0) + 1);
  }
  return decks.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    kind: d.kind,
    part: d.chapter?.part ?? null,
    chapterTitle: d.chapter?.title ?? null,
    total: d._count.cards,
    due: dueByDeck.get(d.id) ?? 0,
    fresh: d._count.cards - (seenByDeck.get(d.id) ?? 0),
  }));
}

export async function getDeck(deckId: string, userId: string | null) {
  const deck = await db.flashcardDeck.findUnique({
    where: { id: deckId },
    include: { cards: { orderBy: { order: "asc" } }, chapter: { select: { title: true, slug: true, part: true } } },
  });
  if (!deck) return null;
  if (deck.kind === "USER" && deck.ownerId !== userId) return null;
  return deck;
}

export function renderCard(card: { front: string; back: string }, trusted: boolean) {
  const render = trusted ? markdownToHtml : userMarkdownToHtml;
  return { frontHtml: render(card.front), backHtml: render(card.back) };
}

/** Builds a review queue: due cards first (oldest due first), then up to N new cards. */
export async function buildReviewQueue(userId: string, deckId: string | null) {
  const deckFilter = deckId
    ? { deckId }
    : { deck: { OR: [{ kind: "BUILT_IN" as const }, { ownerId: userId }] } };
  const now = new Date();
  const due = await db.flashcardReview.findMany({
    where: { userId, suspended: false, dueAt: { lte: now }, card: deckFilter },
    orderBy: { dueAt: "asc" },
    take: MAX_DUE_PER_SESSION,
    select: { card: { select: { id: true, front: true, back: true, deck: { select: { kind: true, title: true } } } }, repetitions: true },
  });
  const fresh = await db.flashcard.findMany({
    where: { ...deckFilter, reviews: { none: { userId } } },
    orderBy: [{ deck: { createdAt: "asc" } }, { order: "asc" }],
    take: NEW_CARDS_PER_SESSION,
    select: { id: true, front: true, back: true, deck: { select: { kind: true, title: true } } },
  });
  const toItem = (c: { id: string; front: string; back: string; deck: { kind: string; title: string } }, isNew: boolean) => ({
    id: c.id,
    deckTitle: c.deck.title,
    isNew,
    ...renderCard(c, c.deck.kind === "BUILT_IN"),
  });
  return [...due.map((d) => toItem(d.card, false)), ...fresh.map((c) => toItem(c, true))];
}
