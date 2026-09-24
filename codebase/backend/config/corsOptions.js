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
  ALLOWED_ORIGINS.push('http://34.44.69.85');// without port
  ALLOWED_ORIGINS.push('http://34.228.197.201');
}

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    // Only permit this in development — lock it down in production
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // In production, block no-origin requests to the API
      return callback(new Error('CORS: request with no origin blocked in production'));
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
