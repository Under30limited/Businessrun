/**
 * server/index.js
 *
 * BusinessRun API — Express entry point.
 *
 * Middleware stack (in order):
 *   1. dotenv       — loads .env into process.env
 *   2. helmet       — sets secure HTTP response headers
 *   3. cors         — enforces origin whitelist
 *   4. morgan       — HTTP request logging
 *   5. express.json — parses JSON request bodies
 *   6. routes       — all /api/* route handlers
 *   7. 404 handler  — catches requests that matched no route
 *   8. errorHandler — global error formatter (must be last)
 *
 * ── FIREBASE REMOVED ────────────────────────────────────────────
 * This used to also initialise the Firebase Admin SDK here (step 2,
 * `require('./config/firebase')`) so misconfiguration failed fast at
 * startup. That's gone now — the last real Firebase dependency
 * (utils/otp.js) has been migrated to DynamoDB (see otp.js), and
 * services/firebase.service.js + services/auth.service.js were dead
 * code (nothing required them) and have been deleted. The app no
 * longer talks to Firebase/Firestore/Firebase Auth anywhere.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Load environment variables first — everything depends on this ──
require('dotenv').config();

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
const personalOnboardingRoutes = require('./routes/personalOnboarding.routes');
const personalAccountsRoutes   = require('./routes/personalAccounts.routes');
const personalIncomeRoutes     = require('./routes/personalIncome.routes');
const personalExpensesRoutes   = require('./routes/personalExpenses.routes');
const personalAssetsRoutes     = require('./routes/personalAssets.routes');
const personalGoalsRoutes      = require('./routes/personalGoals.routes');
const personalDebtsRoutes      = require('./routes/personalDebts.routes');
const personalNetWorthRoutes   = require('./routes/personalNetWorth.routes');
const personalDayLogRoutes     = require('./routes/personalDayLog.routes');
const personalAdvisorRoutes    = require('./routes/personalAdvisor.routes');
const personalProfileRoutes    = require('./routes/personalProfile.routes');
const contactRoutes            = require('./routes/contact.routes');
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
const teamRoutes         = require('./routes/team.routes');
const paymentsRoutes     = require('./routes/payments.routes');
const plansRoutes        = require('./routes/plans.routes');

// ─────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ── HTTP request logging ──────────────────────────────────────────
app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// ── Cookie parsing ───────────────────────────────────────────────
app.use(cookieParser());

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({
  limit: '5mb',
  // Stash the raw bytes for every request — needed by the Paystack
  // webhook handler (routes/payments.routes.js), which must verify
  // its signature against the EXACT bytes Paystack sent, not a
  // JSON.stringify() of the already-parsed body (those can differ in
  // key order/whitespace and silently break verification — this is
  // the single most common mistake in Paystack webhook integrations).
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Health check ──────────────────────────────────────────────────
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
app.use('/api/personal/onboarding', personalOnboardingRoutes);
app.use('/api/personal/accounts',   personalAccountsRoutes);
app.use('/api/personal/income',     personalIncomeRoutes);
app.use('/api/personal/expenses',   personalExpensesRoutes);
app.use('/api/personal/assets',     personalAssetsRoutes);
app.use('/api/personal/goals',      personalGoalsRoutes);
app.use('/api/personal/debts',      personalDebtsRoutes);
app.use('/api/personal/networth',   personalNetWorthRoutes);
app.use('/api/personal/daylog',     personalDayLogRoutes);
app.use('/api/personal/advisor',    personalAdvisorRoutes);
app.use('/api/personal/profile',    personalProfileRoutes);
app.use('/api/contact',             contactRoutes);
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
app.use('/api/team', teamRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/plans', plansRoutes);

// ── 404 — no route matched ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[BusinessRun API] Server running on port ${PORT}`);
  console.log(`[BusinessRun API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[BusinessRun API] Health check: http://localhost:${PORT}/api/health\n`);
});

// ── Unhandled rejection safety net ───────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[BusinessRun API] Unhandled rejection:', reason);
  process.exit(1);
});

module.exports = app;
