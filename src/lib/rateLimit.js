const BUCKET_LIMITS = {
  read: 100,
  write: 30,
  payment: 10,
};

const WINDOW_MS = 60 * 1000;
const store = new Map();

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) {
      return firstIp;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

export function checkRateLimit(request, bucket) {
  const now = Date.now();
  if (store.size > 500) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt <= now) {
        store.delete(k);
      }
    }
  }

  const ip = getClientIp(request);
  const key = `${bucket}:${ip}`;
  const limit = BUCKET_LIMITS[bucket] || 100;

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((entry.resetAt - now) / 1000)
  );
  return { allowed: false, retryAfterSeconds };
}
