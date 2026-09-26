/**
 * config/corsOptions.js
 *
 * CORS configuration.
 *
 * In production:  only thebusinessrun.com is allowed.
 * In development: localhost:3000 is also allowed so `npm start`
 *                 can talk to the Express server directly.
 *
 * The React app's "proxy" field in package.json also handles this
 * during development, but this whitelist is the authoritative rule
 * on the server side.
 */

'use strict';

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL             || 'https://thebusinessrun.com',
  `www.${(process.env.FRONTEND_URL || 'https://thebusinessrun.com').replace('https://', '')}`,
  'https://thebusinessrun.com',
  'https://www.thebusinessrun.com',
  'https://test.thebusinessrun.com',
].filter((v, i, arr) => arr.indexOf(v) === i);  // deduplicate

// Allow localhost in non-production environments
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
  ALLOWED_ORIGINS.push('http://127.0.0.1:3000');
  ALLOWED_ORIGINS.push('http://34.44.69.85');
  ALLOWED_ORIGINS.push('http://34.228.197.201');
}

// CORS_EXTRA_ORIGINS: comma-separated list of additional origins to allow
// Useful for testing production mode locally:
//   CORS_EXTRA_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
if (process.env.CORS_EXTRA_ORIGINS) {
  process.env.CORS_EXTRA_ORIGINS.split(',')
    .map(o => o.trim())
    .filter(Boolean)
    .forEach(origin => {
      if (!ALLOWED_ORIGINS.includes(origin)) {
        ALLOWED_ORIGINS.push(origin);
      }
    });
}

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin:
    // - Same-origin requests (browser doesn't send Origin header)
    // - Requests through nginx proxy (Origin header stripped)
    // - curl, Postman, server-to-server
    // This is safe because the cookie's SameSite=lax + httpOnly flags
    // protect against CSRF, not the Origin header check.
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} is not allowed`));
    }
  },

  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,   // needed if you ever use cookies or auth headers
  maxAge:      86400,  // cache preflight for 24 hours
};

module.exports = corsOptions;
