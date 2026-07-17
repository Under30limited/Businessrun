/**
 * server/index.js
 *
 * BusinessRun API — Express entry point.
 *
 * Middleware stack (in order):
 *   1. dotenv       — loads .env into process.env
 *   2. firebase     — initialises Firebase Admin SDK (fails fast if misconfigured)
 *   3. helmet       — sets secure HTTP response headers
 *   4. cors         — enforces origin whitelist
 *   5. morgan       — HTTP request logging
 *   6. express.json — parses JSON request bodies
 *   7. routes       — all /api/* route handlers
 *   8. 404 handler  — catches requests that matched no route
 *   9. errorHandler — global error formatter (must be last)
 */

'use strict';

// ── Load environment variables first — everything depends on this ──
require('dotenv').config();

// ── Initialise Firebase Admin SDK immediately after env vars load ──
// This will throw synchronously on startup if any credential env var
// is missing, so the problem is caught before any request is served.
require('./config/firebase');

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const corsOptions  = require('./config/corsOptions');
const errorHandler = require('./middleware/errorHandler');

// ── Route modules ─────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const gybRoutes          = require('./routes/gyb.routes');
const advisorRoutes      = require('./routes/advisor.routes');
const accountingRoutes   = require('./routes/accounting.routes');
const roadmapRoutes      = require('./routes/roadmap.routes');
const nominationsRoutes  = require('./routes/nominations.routes');
const subscribersRoutes  = require('./routes/subscribers.routes');
const under30Routes      = require('./routes/under30.routes');
const cfoRoutes          = require('./routes/cfo.routes');
const inventoryRoutes    = require('./routes/inventory.routes');
const salesRoutes        = require('./routes/sales.routes');
const daylogRoutes 	 = require('./routes/daylog.routes');
const reportRoutes	 = require('./routes/reports.routes');

// ─────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────
// helmet sets:
//   X-Content-Type-Options: nosniff
//   X-Frame-Options: DENY
//   Strict-Transport-Security (HSTS)
//   Content-Security-Policy (default-src 'self')
//   ...and more
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ── HTTP request logging ──────────────────────────────────────────
// 'combined' format: IP, method, URL, status, response time, user-agent
// PM2 captures this to logs/businessrun-api-out.log
app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// ── Cookie parsing ───────────────────────────────────────────────
// Parses the Cookie header and populates req.cookies.
// Required for reading the HTTP-only JWT session cookie (br_token).
// Must be registered before any route handler that calls req.cookies.
app.use(cookieParser());

// ── Body parsing ──────────────────────────────────────────────────
// Limit body size to 10kb — protects against large payload attacks.
// Accounting reports with many transactions stay well under this.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Health check ──────────────────────────────────────────────────
// Used by Nginx, PM2, and monitoring tools to confirm the server is up.
// No auth, no rate limit — must be fast and always available.
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'businessrun-api',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── API routes ────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/gyb',            gybRoutes);
app.use('/api/advisor',        advisorRoutes);
app.use('/api/accounting',     accountingRoutes);
app.use('/api/roadmap-insight',roadmapRoutes);
app.use('/api/nominations',    nominationsRoutes);
app.use('/api',                subscribersRoutes);   // mounts /api/subscribe + /api/resources
app.use('/api/under30',        under30Routes);
app.use('/api/cfo',            cfoRoutes);
app.use('/api/inventory',      inventoryRoutes);
app.use('/api/sales',          salesRoutes);
app.use('/api/daylog', daylogRoutes);
app.use('/api/reports', reportRoutes);

// ── 404 — no route matched ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Global error handler ──────────────────────────────────────────
// Must be registered LAST — Express identifies error handlers by
// their 4-argument signature (err, req, res, next).
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[BusinessRun API] Server running on port ${PORT}`);
  console.log(`[BusinessRun API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[BusinessRun API] Health check: http://localhost:${PORT}/api/health\n`);
});

// ── Unhandled rejection safety net ───────────────────────────────
// Catches any promise rejection that wasn't caught by asyncHandler.
// Logs and exits — PM2 will restart the process automatically.
process.on('unhandledRejection', (reason) => {
  console.error('[BusinessRun API] Unhandled rejection:', reason);
  process.exit(1);
});

module.exports = app;
