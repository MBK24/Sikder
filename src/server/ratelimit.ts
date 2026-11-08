import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by the RateLimit table (shared with Better Auth),
 * so it works on serverless without another service. Keys are namespaced "app:".
 * Returns true when the action is allowed.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const k = `app:${key}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  // Single atomic upsert: reset the window if it expired, otherwise increment.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" (id, key, count, "lastRequest")
    VALUES (gen_random_uuid()::text, ${k}, 1, ${BigInt(now)})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimit"."lastRequest" < ${BigInt(now - windowMs)} THEN 1 ELSE "RateLimit".count + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" < ${BigInt(now - windowMs)} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
    RETURNING count`;
  return (rows[0]?.count ?? 1) <= max;
}

export class RateLimitError extends Error {
  constructor() {
    super("You're doing that too often. Please wait a bit and try again.");
  }
}
