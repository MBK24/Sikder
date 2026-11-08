import { describe, expect, it } from "vitest";
import { quotaPeriodStart } from "@/lib/periods";

const d = (s: string) => new Date(s);

describe("quotaPeriodStart", () => {
  it("uses the most recent monthly anniversary of the billing anchor", () => {
    expect(quotaPeriodStart(d("2026-01-15T10:00:00Z"), d("2026-03-20T00:00:00Z")).toISOString()).toBe("2026-03-15T10:00:00.000Z");
    expect(quotaPeriodStart(d("2026-01-15T10:00:00Z"), d("2026-03-10T00:00:00Z")).toISOString()).toBe("2026-02-15T10:00:00.000Z");
  });
  it("resets monthly for annual plans too", () => {
    expect(quotaPeriodStart(d("2026-01-15T00:00:00Z"), d("2026-07-16T00:00:00Z")).toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
  it("clamps the 31st to short months", () => {
    expect(quotaPeriodStart(d("2026-01-31T00:00:00Z"), d("2026-02-28T12:00:00Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
  it("never starts before the subscription itself", () => {
    expect(quotaPeriodStart(d("2026-03-20T00:00:00Z"), d("2026-03-21T00:00:00Z")).toISOString()).toBe("2026-03-20T00:00:00.000Z");
  });
  it("falls back to the calendar month without an anchor", () => {
    expect(quotaPeriodStart(null, d("2026-03-21T00:00:00Z")).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
