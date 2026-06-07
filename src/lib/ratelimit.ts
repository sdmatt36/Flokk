import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Policy: fail-open on transient error, fail-loud on misconfiguration.
//
// Misconfiguration (missing env vars at init): logs an explicit, loud error.
// We do NOT silently build a no-op limiter — that would hide the problem
// and leave the app unprotected with no indication in logs.
//
// Transient Redis error (network blip at request time): caught in checkLimit,
// request is ALLOWED, error is logged. A Redis outage must never block
// tour generation or any other user-facing feature.

const missingVars: string[] = [];
if (!process.env.UPSTASH_REDIS_REST_URL) missingVars.push("UPSTASH_REDIS_REST_URL");
if (!process.env.UPSTASH_REDIS_REST_TOKEN) missingVars.push("UPSTASH_REDIS_REST_TOKEN");

let redis: Redis | null = null;
if (missingVars.length > 0) {
  console.error(
    `[ratelimit] MISCONFIGURATION: missing env vars: ${missingVars.join(", ")}. ` +
    `Rate limiting is DISABLED. Set these vars in Vercel (Production + Preview) and redeploy.`
  );
} else {
  redis = Redis.fromEnv();
}

function makeLimiter(
  tokens: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: "flokk:rl",
  });
}

// Limiters keyed by route. All use per-userId sliding windows.
export const limiters = {
  toursGenerate: makeLimiter(3, "1 h"),   // 3 generations per hour
  extract:       makeLimiter(30, "1 h"),  // 30 URL extractions per hour
  aiLookup:      makeLimiter(60, "1 m"),  // 60 AI lookups per minute (destinations + activities)
} as const;

export type LimiterKey = keyof typeof limiters;

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

/**
 * Check whether userId has exceeded the named limit.
 * Returns { limited: false } if allowed OR if Redis is unavailable (fail-open).
 * Returns { limited: true, retryAfterSeconds } when the window is exhausted.
 */
export async function checkLimit(
  key: LimiterKey,
  userId: string,
): Promise<RateLimitResult> {
  const limiter = limiters[key];
  if (!limiter) {
    // Misconfigured — fail open rather than blocking all users.
    return { limited: false };
  }
  try {
    const result = await limiter.limit(userId);
    if (!result.success) {
      const retryAfterSeconds = Math.max(
        Math.ceil((result.reset - Date.now()) / 1000),
        1,
      );
      return { limited: true, retryAfterSeconds };
    }
    return { limited: false };
  } catch (err) {
    // Transient Redis error — fail open so the feature stays available.
    console.error(`[ratelimit] Redis check failed for key=${key} userId=${userId}:`, err);
    return { limited: false };
  }
}
