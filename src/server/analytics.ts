import "server-only";
import { db } from "./db";
import { localDate } from "./study-day";
import { estimateScaled } from "./practice";
import { computeStreak, readinessScore, READINESS_WEIGHTS } from "@/lib/scoring";
export { READINESS_WEIGHTS };
import type { Part } from "@/generated/prisma/enums";

const DAY = 86_400_000;
export const SECTIONS = ["CP", "CARS", "BB", "PS"] as const;
export const SECTION_NAME: Record<(typeof SECTIONS)[number], string> = {
  CP: "Chem/Phys",
  CARS: "CARS",
  BB: "Bio/Biochem",
  PS: "Psych/Soc",
};

export interface WeekPoint {
  week: string; // ISO date of the week's Monday
  answered: number;
  correct: number;
}
export interface TopicStat {
  code: string;
  name: string;
  part: string;
  answered: number;
  correct: number;
}
export interface SectionStat {
  part: (typeof SECTIONS)[number];
  answered: number;
  correct: number;
  avgTimeMs: number | null;
  recentAccuracy: number | null;
  coverage: number;
  chaptersDone: number;
  chaptersTotal: number;
  readiness: number;
  scaledBand: [number, number] | null;
}
export interface DayCell {
  date: string;
  questions: number;
  cards: number;
  minutes: number;
}
export interface Analytics {
  totals: { answered: number; correct: number; avgTimeMs: number | null; cardsReviewed: number; chaptersDone: number; minutesReading: number };
  streak: { current: number; longest: number };
  weeks: WeekPoint[];
  topics: TopicStat[];
  sections: SectionStat[];
  days: DayCell[];
  sample: boolean;
}

const MIN_FOR_BAND = 30;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date) {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

export async function getAnalytics(userId: string): Promise<Analytics> {
  const today = await localDate(userId);
  const weeksBack = 12;
  const since = new Date(mondayOf(today).getTime() - (weeksBack - 1) * 7 * DAY);
  const heatSince = new Date(mondayOf(today).getTime() - 15 * 7 * DAY);

  const [weekRows, topicRows, sectionRows, timeRows, recentRows, coverageRows, topicTotals, chapterRows, progressRows, studyDays, cards] =
    await Promise.all([
      db.$queryRaw<{ week: Date; answered: bigint; correct: bigint }[]>`
        SELECT date_trunc('week', "createdAt") AS week, count(*) AS answered, count(*) FILTER (WHERE correct) AS correct
        FROM "QuestionAttempt" WHERE "userId" = ${userId} AND "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ code: string; name: string; part: string; answered: bigint; correct: bigint }[]>`
        SELECT t.code, t.name, t.part::text AS part, count(*) AS answered, count(*) FILTER (WHERE a.correct) AS correct
        FROM "QuestionAttempt" a JOIN "Question" q ON q.id = a."questionId" JOIN "Topic" t ON t.id = q."topicId"
        WHERE a."userId" = ${userId}
        GROUP BY t.code, t.name, t.part`,
      db.$queryRaw<{ part: string; answered: bigint; correct: bigint }[]>`
        SELECT q.part::text AS part, count(*) AS answered, count(*) FILTER (WHERE a.correct) AS correct
        FROM "QuestionAttempt" a JOIN "Question" q ON q.id = a."questionId"
        WHERE a."userId" = ${userId} GROUP BY q.part`,
      // Time per question only from timed/structured contexts where the clock is meaningful.
      db.$queryRaw<{ part: string; avg: number | null }[]>`
        SELECT q.part::text AS part, avg(a."timeSpentMs")::float AS avg
        FROM "QuestionAttempt" a JOIN "Question" q ON q.id = a."questionId"
        WHERE a."userId" = ${userId} AND a.context IN ('PRACTICE','TEST','QUIZ') AND a.selected IS NOT NULL AND a."timeSpentMs" > 0
        GROUP BY q.part`,
      // Most recent 100 attempts per section → recent accuracy.
      db.$queryRaw<{ part: string; n: bigint; correct: bigint }[]>`
        SELECT part, count(*) AS n, count(*) FILTER (WHERE correct) AS correct FROM (
          SELECT q.part::text AS part, a.correct,
                 row_number() OVER (PARTITION BY q.part ORDER BY a."createdAt" DESC) AS rn
          FROM "QuestionAttempt" a JOIN "Question" q ON q.id = a."questionId"
          WHERE a."userId" = ${userId}
        ) r WHERE rn <= 100 GROUP BY part`,
      // A topic counts as "covered" in a section once you've answered ≥3 of that section's questions on it.
      // (Grouped by the question's section, since AAMC categories like 5E appear in both C/P and B/B.)
      db.$queryRaw<{ part: string; covered: bigint }[]>`
        SELECT part, count(*) AS covered FROM (
          SELECT q.part::text AS part, q."topicId" FROM "QuestionAttempt" a
          JOIN "Question" q ON q.id = a."questionId"
          WHERE a."userId" = ${userId} AND q."topicId" IS NOT NULL
          GROUP BY q.part, q."topicId" HAVING count(*) >= 3
        ) c GROUP BY part`,
      db.$queryRaw<{ part: string; n: bigint }[]>`
        SELECT part::text AS part, count(DISTINCT "topicId") AS n FROM "Question"
        WHERE published AND "inBank" AND "topicId" IS NOT NULL GROUP BY part`,
      db.chapter.groupBy({ by: ["part"], where: { status: "PUBLISHED" }, _count: true }),
      db.chapterProgress.findMany({ where: { userId, completed: true }, select: { chapter: { select: { part: true } } } }),
      db.studyDay.findMany({ where: { userId }, select: { date: true, questionsAnswered: true, cardsReviewed: true, secondsReading: true } }),
      db.flashcardReviewLog.count({ where: { userId } }),
    ]);

  const weeks: WeekPoint[] = [];
  for (let i = 0; i < weeksBack; i++) {
    const w = iso(new Date(since.getTime() + i * 7 * DAY));
    const row = weekRows.find((r) => iso(r.week) === w);
    weeks.push({ week: w, answered: Number(row?.answered ?? 0), correct: Number(row?.correct ?? 0) });
  }

  const doneByPart = new Map<Part, number>();
  for (const p of progressRows) doneByPart.set(p.chapter.part, (doneByPart.get(p.chapter.part) ?? 0) + 1);

  const sections: SectionStat[] = SECTIONS.map((part) => {
    const s = sectionRows.find((r) => r.part === part);
    const recent = recentRows.find((r) => r.part === part);
    const recentN = Number(recent?.n ?? 0);
    const recentAccuracy = recentN ? Number(recent!.correct) / recentN : null;
    const topicsTotal = Number(topicTotals.find((t) => t.part === part)?.n ?? 0);
    const coverage = topicsTotal ? Number(coverageRows.find((c) => c.part === part)?.covered ?? 0) / topicsTotal : 0;
    const chaptersTotal = chapterRows.find((c) => c.part === part)?._count ?? 0;
    const chaptersDone = doneByPart.get(part) ?? 0;
    const reading = chaptersTotal ? chaptersDone / chaptersTotal : 0;
    const answered = Number(s?.answered ?? 0);
    let scaledBand: [number, number] | null = null;
    if (recentAccuracy !== null && recentN >= MIN_FOR_BAND) {
      const mid = estimateScaled(Math.round(recentAccuracy * recentN), recentN)!;
      scaledBand = [Math.max(118, mid - 2), Math.min(132, mid + 2)];
    }
    return {
      part,
      answered,
      correct: Number(s?.correct ?? 0),
      avgTimeMs: timeRows.find((t) => t.part === part)?.avg ?? null,
      recentAccuracy,
      coverage,
      chaptersDone,
      chaptersTotal,
      readiness: readinessScore(recentAccuracy, coverage, reading),
      scaledBand,
    };
  });

  const dayMap = new Map(studyDays.map((d) => [iso(d.date), d]));
  const days: DayCell[] = [];
  for (let t = heatSince.getTime(); t <= today.getTime(); t += DAY) {
    const key = iso(new Date(t));
    const d = dayMap.get(key);
    days.push({ date: key, questions: d?.questionsAnswered ?? 0, cards: d?.cardsReviewed ?? 0, minutes: Math.round((d?.secondsReading ?? 0) / 60) });
  }

  const answered = sections.reduce((n, s) => n + s.answered, 0);
  const correct = sections.reduce((n, s) => n + s.correct, 0);
  const timed = sections.filter((s) => s.avgTimeMs !== null);
  return {
    totals: {
      answered,
      correct,
      avgTimeMs: timed.length ? timed.reduce((n, s) => n + s.avgTimeMs! * s.answered, 0) / Math.max(1, timed.reduce((n, s) => n + s.answered, 0)) : null,
      cardsReviewed: cards,
      chaptersDone: progressRows.length,
      minutesReading: Math.round(studyDays.reduce((n, d) => n + d.secondsReading, 0) / 60),
    },
    streak: computeStreak(
      studyDays.filter((d) => d.questionsAnswered + d.cardsReviewed + d.secondsReading > 0).map((d) => iso(d.date)),
      iso(today),
    ),
    weeks,
    topics: topicRows.map((t) => ({ code: t.code, name: t.name, part: t.part, answered: Number(t.answered), correct: Number(t.correct) })),
    sections,
    days,
    sample: false,
  };
}

/** Deterministic sample data so free users can see what the dashboard does. */
export function sampleAnalytics(): Analytics {
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const today = new Date(Date.UTC(2026, 0, 30));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const answered = 40 + Math.round(rand() * 60);
    const acc = 0.52 + i * 0.022 + (rand() - 0.5) * 0.06;
    return { week: iso(new Date(mondayOf(today).getTime() - (11 - i) * 7 * DAY)), answered, correct: Math.round(answered * acc) };
  });
  const topics: TopicStat[] = [
    ["5E", "Thermodynamics and kinetics", "CP", 0.48],
    ["4C", "Electrochemistry and circuits", "CP", 0.55],
    ["1D", "Bioenergetics and metabolism", "BB", 0.58],
    ["CARS-RBT", "Reasoning beyond the text", "CARS", 0.61],
    ["7B", "Social influences on behavior", "PS", 0.66],
    ["5A", "Water and solutions", "CP", 0.71],
    ["1A", "Proteins and amino acids", "BB", 0.78],
    ["6A", "Sensing the environment", "PS", 0.83],
  ].map(([code, name, part, acc]) => ({ code: code as string, name: name as string, part: part as string, answered: 40, correct: Math.round(40 * (acc as number)) }));
  const sections: SectionStat[] = SECTIONS.map((part, i) => {
    const recentAccuracy = [0.61, 0.66, 0.7, 0.76][i];
    const coverage = [0.5, 0.67, 0.56, 0.42][i];
    const reading = [0.4, 0.5, 0.55, 0.3][i];
    const mid = estimateScaled(Math.round(recentAccuracy * 100), 100)!;
    return {
      part,
      answered: [310, 260, 340, 220][i],
      correct: Math.round([310, 260, 340, 220][i] * recentAccuracy),
      avgTimeMs: [98_000, 104_000, 87_000, 74_000][i],
      recentAccuracy,
      coverage,
      chaptersDone: Math.round(reading * 10),
      chaptersTotal: 10,
      readiness: readinessScore(recentAccuracy, coverage, reading),
      scaledBand: [mid - 2, mid + 2],
    };
  });
  const days: DayCell[] = [];
  for (let t = mondayOf(today).getTime() - 15 * 7 * DAY; t <= today.getTime(); t += DAY) {
    const active = rand() > 0.25;
    days.push({ date: iso(new Date(t)), questions: active ? Math.round(rand() * 60) : 0, cards: active ? Math.round(rand() * 80) : 0, minutes: active ? Math.round(rand() * 90) : 0 });
  }
  return {
    totals: { answered: 1130, correct: 768, avgTimeMs: 92_000, cardsReviewed: 2140, chaptersDone: 18, minutesReading: 1960 },
    streak: { current: 12, longest: 23 },
    weeks,
    topics,
    sections,
    days,
    sample: true,
  };
}
