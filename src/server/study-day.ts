import "server-only";
import { db } from "./db";

/** Today's date in the user's timezone, as a UTC-midnight Date for a @db.Date column. */
export async function localDate(userId: string, at = new Date()) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { timezone: true } });
  const tz = profile?.timezone ?? "UTC";
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    ymd = at.toISOString().slice(0, 10);
  }
  return new Date(`${ymd}T00:00:00.000Z`);
}

type Increment = Partial<Record<"secondsReading" | "questionsAnswered" | "questionsCorrect" | "cardsReviewed", number>>;

export async function bumpStudyDay(userId: string, inc: Increment) {
  const date = await localDate(userId);
  const increment = Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, { increment: v }]));
  await db.studyDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...inc },
    update: increment,
  });
}
