import { describe, expect, it } from "vitest";
import { NEW_CARD, schedule, formatInterval, MIN_EASE } from "@/lib/srs/sm2";

const now = new Date("2026-01-01T00:00:00Z");
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);

describe("SM-2 schedule", () => {
  it("follows the classic 1 → 6 → ×EF progression on 'good'", () => {
    const a = schedule(NEW_CARD, "good", now);
    expect(a.intervalDays).toBe(1);
    const b = schedule(a, "good", now);
    expect(b.intervalDays).toBe(6);
    const c = schedule(b, "good", now);
    expect(c.intervalDays).toBe(Math.round(6 * c.easeFactor));
    expect(days(c.dueAt)).toBe(c.intervalDays);
  });

  it("keeps ease constant on 'good' (quality 4)", () => {
    expect(schedule(NEW_CARD, "good", now).easeFactor).toBeCloseTo(2.5);
  });

  it("resets repetitions and counts a lapse on 'again'", () => {
    const learned = schedule(schedule(NEW_CARD, "good", now), "good", now);
    const r = schedule(learned, "again", now);
    expect(r.repetitions).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
    expect(r.easeFactor).toBeLessThan(learned.easeFactor);
  });

  it("does not count a lapse for a brand-new card", () => {
    expect(schedule(NEW_CARD, "again", now).lapses).toBe(0);
  });

  it("never drops ease below the SM-2 floor", () => {
    let s = { ...NEW_CARD };
    for (let i = 0; i < 20; i++) s = schedule(s, "again", now);
    expect(s.easeFactor).toBe(MIN_EASE);
  });

  it("orders intervals hard < good < easy", () => {
    const base = schedule(schedule(NEW_CARD, "good", now), "good", now);
    const [h, g, e] = (["hard", "good", "easy"] as const).map((x) => schedule(base, x, now).intervalDays);
    expect(h).toBeLessThan(g);
    expect(g).toBeLessThan(e);
  });

  it("formats intervals for the buttons", () => {
    expect(formatInterval(schedule(NEW_CARD, "again", now), now)).toBe("10m");
    expect(formatInterval(schedule(NEW_CARD, "good", now), now)).toBe("1d");
  });
});
