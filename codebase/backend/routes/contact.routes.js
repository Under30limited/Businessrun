/**
 * routes/contact.routes.js
 *
 * POST /api/contact — public (optionalAuth, not protect): the home
 * page hits this with no session at all, Business OS and Personal
 * Wealth OS hit it while logged in. optionalAuth attaches req.user
 * when a session cookie is present and valid, and leaves it null
 * otherwise — see controllers/contact.controller.js for how that
 * splits the logged-in vs anonymous path.
 *
 * dataLimiter (20 req / hour / IP) — the same limiter already used
 * for GYB onboarding and Personal Wealth OS onboarding: free-to-call
 * form submission routes that need spam protection, not the tighter
 * auth-brute-force limits or the heavier AI-cost limits.
 */

'use strict';

const express      = require('express');
const router       = express.Router();
const controller    = require('../controllers/contact.controller');
const { optionalAuth } = require('../middleware/auth');
const { dataLimiter }  = require('../middleware/rateLimiter');

router.post('/', dataLimiter, optionalAuth, controller.submit);

module.exports = router;
