/**
 * Start of the window the 2-requests quota counts against: the most recent monthly
 * anniversary of the subscription's period start (so annual plans also reset monthly).
 * Users without a billing period (staff) fall back to the calendar month.
 */
export function quotaPeriodStart(anchor: Date | null, now = new Date()): Date {
  if (!anchor) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  const day = anchor.getUTCDate();
  const build = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(day, last), anchor.getUTCHours(), anchor.getUTCMinutes()));
  };
  let start = build(y, m);
  if (start > now) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    start = build(y, m);
  }
  return start < anchor ? anchor : start;
}

