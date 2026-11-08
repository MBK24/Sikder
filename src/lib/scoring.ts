/**
 * Pure scoring/scheduling helpers shared by the practice engine and analytics.
 * Kept free of server-only imports so they can be unit-tested.
 */
const DAY = 86_400_000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Candidate = { id: string; passageId: string | null; passageOrder: number | null };

/**
 * Orders questions the way the real exam does: passage sets kept together (in
 * passage order) with blocks of discrete questions between them.
 */
export function arrangeLikeExam(candidates: Candidate[], count: number): string[] {
  const byPassage = new Map<string, Candidate[]>();
  const discretes: Candidate[] = [];
  for (const c of candidates) {
    if (c.passageId) byPassage.set(c.passageId, [...(byPassage.get(c.passageId) ?? []), c]);
    else discretes.push(c);
  }
  const passageSets = shuffle([...byPassage.values()]).map((qs) => qs.sort((a, b) => (a.passageOrder ?? 0) - (b.passageOrder ?? 0)));
  const loose = shuffle(discretes);

  // Fill roughly 75% from passages, the rest from discretes (MCAT science sections are ~44/15).
  const out: string[] = [];
  const blocks: string[][] = [];
  let passageBudget = Math.round(count * (loose.length ? 0.75 : 1));
  for (const set of passageSets) {
    if (passageBudget <= 0) break;
    const take = set.slice(0, passageBudget);
    blocks.push(take.map((c) => c.id));
    passageBudget -= take.length;
  }
  const used = blocks.reduce((n, b) => n + b.length, 0);
  const discreteIds = loose.slice(0, count - used).map((c) => c.id);
  // If discretes run short, top up with remaining passage questions.
  let shortfall = count - used - discreteIds.length;
  for (const set of passageSets) {
    if (shortfall <= 0) break;
    const unused = set.filter((c) => !blocks.some((b) => b.includes(c.id))).slice(0, shortfall);
    if (unused.length) blocks.push(unused.map((c) => c.id));
    shortfall -= unused.length;
  }
  // Interleave: a discrete block after every few passage blocks.
  const discreteBlocks = Math.max(1, Math.min(3, Math.ceil(discreteIds.length / 5)));
  const perBlock = Math.ceil(discreteIds.length / discreteBlocks);
  const gap = Math.max(1, Math.ceil(blocks.length / discreteBlocks));
  let d = 0;
  blocks.forEach((b, i) => {
    out.push(...b);
    if ((i + 1) % gap === 0 && d < discreteIds.length) {
      out.push(...discreteIds.slice(d, d + perBlock));
      d += perBlock;
    }
  });
  out.push(...discreteIds.slice(d));
  return out.slice(0, count);
}

/** Rough scaled-score estimate for a section test. Clearly labeled as an estimate in the UI. */
export function estimateScaled(correct: number, total: number) {
  if (!total) return null;
  const pct = correct / total;
  // ~chance (25%) ↦ 118, ~95% ↦ 132, linear between.
  const raw = 118 + ((pct - 0.25) / 0.7) * 14;
  return Math.max(118, Math.min(132, Math.round(raw)));
}

/** Readiness weights, shown to the user so the estimate is transparent. */
export const READINESS_WEIGHTS = { accuracy: 0.6, coverage: 0.25, reading: 0.15 } as const;
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeStreak(dates: string[], today: string) {
  const set = new Set(dates);
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`);
    run = prev !== null && t - prev === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  // Current streak counts back from today, or from yesterday if today has no activity yet.
  let cursor = Date.parse(`${today}T00:00:00Z`);
  if (!set.has(today)) cursor -= DAY;
  let current = 0;
  while (set.has(iso(new Date(cursor)))) {
    current++;
    cursor -= DAY;
  }
  return { current, longest };
}

export function readinessScore(recentAccuracy: number | null, coverage: number, reading: number) {
  const acc = recentAccuracy ?? 0;
  return Math.round(100 * (READINESS_WEIGHTS.accuracy * acc + READINESS_WEIGHTS.coverage * coverage + READINESS_WEIGHTS.reading * reading));
}

