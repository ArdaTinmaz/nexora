const { extractClientIpFromRequest } = require('./requestMeta');

const buckets = new Map();

const sweepExpiredBuckets = (now) => {
  buckets.forEach((value, key) => {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  });
};

const createEndpointRateLimiter = ({
  scope,
  windowMs = 60 * 1000,
  maxRequests = 20,
  keyResolver = null,
} = {}) => {
  const safeScope = String(scope || 'endpoint');

  return (req, res, next) => {
    const now = Date.now();
    if (Math.random() < 0.02) {
      sweepExpiredBuckets(now);
    }

    const ip = extractClientIpFromRequest(req);
    const customKey = typeof keyResolver === 'function' ? keyResolver(req) : '';
    const key = `${safeScope}:${customKey || ip || 'unknown'}`;

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    existing.count += 1;
    buckets.set(key, existing);
    return next();
  };
};

module.exports = {
  createEndpointRateLimiter,
};
