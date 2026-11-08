/**
 * SM-2 spaced repetition (Wozniak 1990), with two small, common adjustments:
 *  - "Again" schedules the card 10 minutes out (so it returns in the same session)
 *    instead of a full day.
 *  - "Easy" gets a 1.3× interval bonus.
 * Pure and deterministic: pass `now` in.
 */
export type Grade = "again" | "hard" | "good" | "easy";

/** SM-2 quality scores for each button. */
export const GRADE_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export interface CardState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ScheduleResult extends CardState {
  dueAt: Date;
  quality: number;
}

export const NEW_CARD: CardState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
export const MIN_EASE = 1.3;
const DAY = 86_400_000;

export function schedule(state: CardState, grade: Grade, now: Date): ScheduleResult {
  const q = GRADE_QUALITY[grade];
  const easeFactor = Math.max(MIN_EASE, state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    return {
      easeFactor,
      intervalDays: 0,
      repetitions: 0,
      lapses: state.lapses + (state.repetitions > 0 ? 1 : 0),
      dueAt: new Date(now.getTime() + 10 * 60_000),
      quality: q,
    };
  }

  let intervalDays: number;
  if (state.repetitions === 0) intervalDays = 1;
  else if (state.repetitions === 1) intervalDays = 6;
  else intervalDays = Math.round(state.intervalDays * easeFactor);
  if (grade === "hard") intervalDays = Math.max(1, Math.round(intervalDays * 0.8));
  if (grade === "easy") intervalDays = Math.round(intervalDays * 1.3);
  intervalDays = Math.min(Math.max(intervalDays, 1), 365);

  return {
    easeFactor,
    intervalDays,
    repetitions: state.repetitions + 1,
    lapses: state.lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY),
    quality: q,
  };
}

/** Human-readable preview for the grade buttons ("10m", "1d", "6d", "2mo"). */
export function formatInterval(r: ScheduleResult, now: Date) {
  const ms = r.dueAt.getTime() - now.getTime();
  if (ms < DAY) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}
