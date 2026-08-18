const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const buckets = new Map<string, { count: number; windowStart: number }>();

// In-memory per-process rate limit, mirroring the WordPress plugin's MCP
// server limit (60 req/min). NOTE: this is per Node process, not shared
// across instances — fine for a single-instance deployment, but not a
// correct global limit if this app is horizontally scaled.
export const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
};
