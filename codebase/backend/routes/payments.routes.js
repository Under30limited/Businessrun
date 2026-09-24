/**
 * routes/payments.routes.js
 *
 *   POST /api/payments/initialize        (owner)     — start a checkout for a plan
 *   GET  /api/payments/verify/:reference (optional)  — instant post-checkout status
 *   POST /api/payments/webhook           (public)    — Paystack event delivery
 *
 * The webhook route has NO protect/auth middleware — Paystack calls it
 * directly with no session cookie. Its security comes entirely from
 * signature verification inside the controller (req.rawBody +
 * x-paystack-signature), not from anything in this file.
 *
 * /verify uses optionalAuth, NOT protect — deliberately. Paystack's
 * hosted checkout (card entry, OTP, 3D Secure) can take several
 * minutes; a session that was already close to expiring can lapse
 * during that window, and this is the ONE moment a founder most
 * needs the confirmation to still work. The controller re-derives
 * everything it needs from Paystack's own verified transaction data
 * (paystack.verifyTransaction, called server-side with our secret
 * key) — the same trust model the signature-verified webhook already
 * uses unauthenticated — so a live session here is a nice-to-have
 * extra ownership check, not a requirement for correctness. See the
 * controller for exactly how req.user is used when present vs absent.
 */

'use strict';

const express       = require('express');
const router        = express.Router();
const controller    = require('../controllers/payments.controller');
const { protect, optionalAuth } = require('../middleware/auth');
const { dataLimiter } = require('../middleware/rateLimiter');

// ── Public — Paystack calls this directly, no session ────────────────
router.post('/webhook', controller.webhook);

// ── Requires a live session — no Paystack-verified data exists yet ───
router.post('/initialize',        protect, dataLimiter, controller.initialize);

// ── Session optional — see file header for why ────────────────────────
router.get('/verify/:reference',  optionalAuth, dataLimiter, controller.verify);

module.exports = router;
