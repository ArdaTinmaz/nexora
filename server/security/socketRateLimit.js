const buckets = new Map();

const cleanup = (now) => {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
};

const checkSocketEventRateLimit = ({ key, windowMs, maxEvents }) => {
  const now = Date.now();
  if (Math.random() < 0.02) cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= maxEvents) {
    return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
};

module.exports = {
  checkSocketEventRateLimit,
};
