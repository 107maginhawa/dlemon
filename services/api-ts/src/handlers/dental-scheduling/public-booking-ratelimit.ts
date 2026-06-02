/**
 * public-booking-ratelimit.ts (P1-25)
 *
 * Lightweight in-memory fixed-window rate limiter for the unauthenticated
 * public booking surface. The generated routes have no auth middleware, so the
 * abuse guard lives here and is invoked from each public handler.
 *
 * Keyed by `${ip}:${bucket}` (e.g. per-branch availability vs. booking). This is
 * a per-instance limiter — adequate for the single-instance demo / offline
 * deployment; a multi-instance deployment would swap this for a shared store
 * (Valkey). Exposed as a class so tests can inject a clock and reset state.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.limit - 1, resetAt: now + this.windowMs };
    }
    entry.count += 1;
    const resetAt = entry.windowStart + this.windowMs;
    if (entry.count > this.limit) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: this.limit - entry.count, resetAt };
  }

  reset(): void {
    this.hits.clear();
  }
}

// Shared limiters. Reads are more generous than writes.
export const availabilityLimiter = new FixedWindowRateLimiter(60, 60_000); // 60/min per ip+branch
export const bookingWriteLimiter = new FixedWindowRateLimiter(10, 60_000); // 10/min per ip+branch

/** Best-effort client IP from common proxy headers, falling back to a constant. */
export function clientIp(headers: { get(name: string): string | null | undefined }): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
