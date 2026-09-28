// Simple in-memory, per-IP sliding-window rate limiter (Phase 1).
//
// Chosen deliberately over an external store: the project rules forbid
// adding Redis/other infrastructure, and a single-node Render deployment at
// college scale does not need it. Counts reset on process restart, which is
// an acceptable trade-off for abuse protection (not billing).
//
// Limits are intentionally generous because many students share one campus
// network/IP (see each usage in routes/authRoutes.js).

const DEFAULT_MESSAGE = 'Too many requests. Please try again later.';

// Resolves the client key for a request. Render terminates TLS at a proxy,
// so the direct socket address is the proxy, not the student. Prefer the
// left-most X-Forwarded-For entry (set by the Render proxy) so users behind
// the proxy are counted individually. Note: a direct client could spoof
// this header — accepted trade-off, since that only lets an attacker rotate
// buckets (equivalent to no limiter for them) while still protecting the
// API from accidental floods and naive scripted abuse.
const getKey = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
};

/**
 * Creates an Express middleware that allows at most `max` requests per
 * `windowMs` per client key.
 *
 * @param {object} opts
 * @param {number} opts.windowMs - Sliding window size in milliseconds.
 * @param {number} opts.max - Maximum requests allowed inside the window.
 * @param {string} [opts.message] - Message returned with HTTP 429.
 */
const createRateLimiter = ({ windowMs, max, message = DEFAULT_MESSAGE }) => {
  const hits = new Map(); // key -> array of timestamps inside the window

  // Periodically drop stale buckets so the map cannot grow unbounded.
  const cleaner = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, fresh);
      }
    }
  }, Math.max(windowMs, 60 * 1000));
  // Don't keep the Node process alive just for the cleanup timer.
  if (typeof cleaner.unref === 'function') cleaner.unref();

  return (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();
    const cutoff = now - windowMs;

    const recent = (hits.get(key) || []).filter((t) => t > cutoff);

    if (recent.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message,
        data: {},
      });
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  };
};

module.exports = { createRateLimiter };
