/**
 * Minimal in-memory rate limiter.
 *
 * This is intentionally small: it protects the public lookup/booking
 * endpoints from accidental double-clicks and casual abuse. It resets when
 * the server restarts and is per-instance, which is fine for a single
 * free-tier deployment.
 *
 * TODO (later stage): replace with a durable limiter (e.g. Upstash Redis or
 * a `rate_limits` table) before opening the system to the whole campus.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) cleanup(now);
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterMs: 0,
  };
}

function cleanup(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Extract the best-effort client IP from a headers-like object.
 *
 * Priority:
 *  1. `x-real-ip`  — set by nginx/Vercel/CDN and not client-controllable.
 *  2. Rightmost entry of `x-forwarded-for` — the hop added by the last
 *     trusted reverse proxy. Taking the leftmost entry is unsafe because
 *     clients can inject arbitrary IPs at the front of that header.
 *  3. Fall back to "local" (dev environment with no proxy).
 */
interface HeadersLike {
  get(name: string): string | null;
}

export function clientIp(h: HeadersLike): string {
  const realIp = h.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return "local";
}

/** Convenience wrapper for API route handlers. */
export function clientKey(request: Request): string {
  return clientIp(request.headers);
}
