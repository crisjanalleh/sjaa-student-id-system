import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

function currentWindowStart(now: Date, windowSeconds: number): Date {
  return new Date(
    Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds * 1000,
  );
}

export async function rateLimitHit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = currentWindowStart(now, windowSeconds);
  const count = await db.transaction(async (tx) => {
    await tx
      .insert(rateLimits)
      .values({ key, count: 1, windowStart })
      .onDuplicateKeyUpdate({
        set: {
          count: sql`IF(window_start = VALUES(window_start), count + 1, 1)`,
          windowStart: sql`VALUES(window_start)`,
        },
      });

    const rows = await tx
      .select({ count: rateLimits.count })
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);
    if (!rows[0]) throw new Error("Rate-limit counter disappeared during increment");
    return rows[0].count;
  });
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000),
  );

  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

export async function rateLimitPeek(
  key: string,
  windowSeconds: number,
): Promise<{ count: number }> {
  const windowStart = currentWindowStart(new Date(), windowSeconds);
  const rows = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, windowStart)))
    .limit(1);
  return { count: rows[0]?.count ?? 0 };
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

export async function cleanupRateLimits(): Promise<void> {
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff));
  }
}
