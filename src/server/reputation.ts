import "server-only";
import { db } from "./db";
import { hasRole } from "./auth";
import { PRIVILEGES, REP_POINTS, type Privilege } from "@/config/reputation";
import type { Prisma } from "@/generated/prisma/client";
import type { ReputationReason, Role } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

export function hasPrivilege(user: { role: Role }, reputation: number, p: Privilege) {
  return hasRole(user, "TUTOR") || reputation >= PRIVILEGES[p];
}

async function award(
  tx: Tx,
  data: { userId: string; actorId?: string; reason: ReputationReason; delta: number; postId?: string; replyId?: string; voteId?: string },
) {
  await tx.reputationEvent.create({ data });
  await tx.profile.update({ where: { userId: data.userId }, data: { reputation: { increment: data.delta } } });
}

async function revoke(tx: Tx, where: Prisma.ReputationEventWhereInput) {
  const events = await tx.reputationEvent.findMany({ where, select: { id: true, userId: true, delta: true } });
  for (const e of events) {
    await tx.reputationEvent.delete({ where: { id: e.id } });
    await tx.profile.update({ where: { userId: e.userId }, data: { reputation: { decrement: e.delta } } });
  }
}

export function awardVote(tx: Tx, v: { voteId: string; voterId: string; authorId: string; postId?: string; replyId?: string }) {
  const reason: ReputationReason = v.replyId ? "REPLY_UPVOTED" : "POST_UPVOTED";
  return award(tx, {
    userId: v.authorId,
    actorId: v.voterId,
    reason,
    delta: REP_POINTS[reason],
    voteId: v.voteId,
    postId: v.postId,
    replyId: v.replyId,
  });
}

export function revokeVote(tx: Tx, voteId: string) {
  return revoke(tx, { voteId });
}

/** Moves the "accepted" reputation from any previous answer to the new one (or clears it). */
export async function setAcceptedRep(tx: Tx, p: { postId: string; postAuthorId: string; reply: { id: string; authorId: string } | null }) {
  await revoke(tx, { postId: p.postId, reason: { in: ["ANSWER_ACCEPTED", "ACCEPTED_AN_ANSWER"] } });
  if (!p.reply || p.reply.authorId === p.postAuthorId) return; // no rep for accepting your own answer
  await award(tx, {
    userId: p.reply.authorId,
    actorId: p.postAuthorId,
    reason: "ANSWER_ACCEPTED",
    delta: REP_POINTS.ANSWER_ACCEPTED,
    postId: p.postId,
    replyId: p.reply.id,
  });
  await award(tx, {
    userId: p.postAuthorId,
    reason: "ACCEPTED_AN_ANSWER",
    delta: REP_POINTS.ACCEPTED_AN_ANSWER,
    postId: p.postId,
    replyId: p.reply.id,
  });
}

export async function getReputation(userId: string) {
  return (await db.profile.findUnique({ where: { userId }, select: { reputation: true } }))?.reputation ?? 0;
}
