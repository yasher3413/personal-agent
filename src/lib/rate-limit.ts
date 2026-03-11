// Best-effort in-memory rate limiter — persists within warm Vercel Lambda invocations.
// For a ~10-person internal team this is sufficient; swap for Redis if abuse becomes an issue.

const MAX_REQUESTS_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

const userTimestamps = new Map<string, number[]>();

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = (userTimestamps.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  const remaining = Math.max(0, MAX_REQUESTS_PER_MINUTE - timestamps.length);

  if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  userTimestamps.set(userId, timestamps);
  return { allowed: true, remaining: remaining - 1 };
}
