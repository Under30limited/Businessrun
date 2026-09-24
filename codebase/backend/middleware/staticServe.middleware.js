/**
 * staticServe.middleware.js
 *
 * Serves the React production build (CRA `build/` folder) with correct
 * cache headers so browsers always pick up new deployments without users
 * needing to manually clear their cache.
 *
 * HOW THE PROBLEM HAPPENS
 * ───────────────────────
 * CRA already content-hashes every JS/CSS chunk on build:
 *   main.a3f9c12b.chunk.js   ← filename changes every build
 *   2.b7e1d924.chunk.js
 *   main.f4a09c11.css
 *
 * So those assets are safe to cache forever — if the content changes,
 * the filename changes and the browser fetches fresh automatically.
 *
 * The problem is index.html. Its filename NEVER changes. If the browser
 * (or a CDN / reverse proxy) caches index.html, users keep loading the
 * OLD index.html which references OLD chunk filenames that may no longer
 * exist on the server → blank page or stale UI until they force-refresh.
 *
 * THE FIX
 * ───────
 * • index.html  → Cache-Control: no-cache
 *     Browser must revalidate with the server on every navigation.
 *     If the file hasn't changed, server returns 304 (no body transferred).
 *     If it has changed, browser gets the new file and therefore the new
 *     chunk hashes → fresh JS/CSS pulled automatically.
 *
 * • /static/**  → Cache-Control: max-age=31536000, immutable
 *     Safe to cache for 1 year because the filename IS the cache key.
 *
 * • Everything else (fonts, images, manifest.json, etc.)
 *                 → Cache-Control: no-cache
 *     Revalidate each time so icons and manifests stay fresh.
 *
 * USAGE — add to your index.js BEFORE API routes:
 * ─────────────────────────────────────────────────
 *   const serveStatic = require('./middleware/staticServe.middleware');
 *   serveStatic(app);                 // serves build/, handles SPA fallback
 *   app.use('/api', apiRouter);       // API routes after static
 *
 * @param {import('express').Application} app
 */

const path    = require('path');
const express = require('express');

const BUILD_DIR = path.join(__dirname, '..', 'client', 'build');
// Adjust BUILD_DIR above if your React build output lives elsewhere, e.g.:
//   path.join(__dirname, '..', 'build')
//   path.join(__dirname, '..', 'frontend', 'build')

function serveStatic(app) {

  // ── /static/** — hashed filenames, safe to cache for 1 year ──────────
  app.use(
    '/static',
    express.static(path.join(BUILD_DIR, 'static'), {
      maxAge:   '1y',
      immutable: true,
    })
  );

  // ── All other static assets (root-level: manifest, icons, robots…) ───
  // Served with no-cache so changes are always picked up.
  app.use(
    express.static(BUILD_DIR, {
      maxAge: 0,
      etag:   true,   // ETag lets the browser do conditional GET (304)
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          // Belt-and-suspenders: also set Pragma for older proxies
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma',        'no-cache');
          res.setHeader('Expires',       '0');
        } else if (filePath.match(/\.(js|css)$/) && !filePath.includes('/static/')) {
          // Root-level hashed assets (chunk files not inside /static/)
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // ── SPA fallback — all non-API routes return index.html ──────────────
  // This lets React Router handle client-side navigation (e.g. /your-roadmap,
  // /magazine/article/:slug) even on a hard refresh or direct URL visit.
  app.get('*', (req, res, next) => {
    // Let /api/* routes fall through to their own handlers
    if (req.path.startsWith('/api')) return next();

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma',        'no-cache');
    res.setHeader('Expires',       '0');
    res.sendFile(path.join(BUILD_DIR, 'index.html'));
  });
}

module.exports = serveStatic;
