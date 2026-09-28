// Single source of truth for allowed CORS origins (Phase 1).
// Shared by BOTH Express (app.js) and Socket.IO (services/socketService.js)
// so the REST API and the realtime channel can never drift apart.
//
// Policy:
//  - No origin (curl / mobile apps / same-origin)  → allowed
//  - http://localhost:<any port>                   → allowed (development)
//  - Exact production frontend origin              → allowed
//    (default + anything listed in CLIENT_URL, comma-separated)
//  - Anything else (including other *.vercel.app   → rejected
//    deployments, which previously could host a
//    phishing clone of this app against the API)

const DEV_LOCAL_ORIGIN_REGEX = /^http:\/\/localhost(:\d+)?$/;

// The deployed Vercel frontend. Kept as a safe default so a partially
// configured environment can't accidentally lock the real site out.
const DEFAULT_PROD_ORIGIN = 'https://lost-found-matching-platform-sv2h.vercel.app';

const getAllowedOrigins = () => {
  const origins = new Set([DEFAULT_PROD_ORIGIN]);
  (process.env.CLIENT_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .forEach((url) => origins.add(url));
  return Array.from(origins);
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (DEV_LOCAL_ORIGIN_REGEX.test(origin)) return true;
  return getAllowedOrigins().includes(origin);
};

// Express/Socket.IO compatible origin handler.
const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

module.exports = { isOriginAllowed, corsOriginHandler, getAllowedOrigins };
