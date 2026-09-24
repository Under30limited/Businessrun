/**
 * middleware/rateLimiter.js
 *
 * Rate limiters for different route categories.
 * Uses express-rate-limit which tracks request counts in memory
 * (per server process). For multi-process PM2 cluster mode, a
 * shared store (Redis) would be needed — the in-memory store is
 * correct for single-process deployment.
 *
 * Limits are per IP address.
 *
 * Three limiters exported:
 *
 *   advisorLimiter     — AI Advisor chat (30 req / 15 min per IP)
 *   accountingLimiter  — Accounting AI   (10 req / 15 min per IP)
 *   roadmapLimiter     — Roadmap insight  (5 req  / 60 min per IP)
 *   dataLimiter        — Form submissions (20 req / 60 min per IP)
 *   authLimiter        — Auth routes      (10 req / 15 min per IP)
 *
 * Why different limits?
 *   AI routes cost money per call (Gemini API).
 *   Form routes are free but should be protected from spam.
 *   Auth routes need tighter limits to prevent brute force.
 */

'use strict';

const rateLimit = require('express-rate-limit');

// ── Shared handler for all rate limit responses ───────────────────
// Returns the same shape as other API errors for consistency.
function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests from this IP. Please wait before trying again.',
  });
}

// ── AI Advisor chat ────────────────────────────────────────────────
// 30 requests per 15 minutes — generous enough for normal use,
// tight enough to prevent abuse of paid Gemini quota.
const advisorLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              30,
  standardHeaders:  true,           // sends RateLimit-* headers to client
  legacyHeaders:    false,
  handler:          rateLimitHandler,
  keyGenerator:     (req) => req.ip,
  message:          'Too many advisor requests.',
  skipSuccessfulRequests: false,
});

// ── Accounting AI report ───────────────────────────────────────────
// 10 per 15 minutes — heavier Gemini call, lower limit.
const accountingLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
});

// ── Roadmap insight ────────────────────────────────────────────────
// 5 per hour — this is called once per onboarding session.
// Tight limit is fine; legitimate users never hit it.
const roadmapLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,  // 1 hour
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
});

// ── Data / form submission routes ──────────────────────────────────
// 20 per hour — covers the full GYB onboarding (4 steps) multiple
// times, while blocking spam bots.
const dataLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
});

// ── Dashboard data routes (Inventory, Sales, CFO entries) ──────────
// 300 per 15 minutes — these power an actively-used dashboard where
// every page load, add, edit, delete and history lookup counts as a
// request. Far more generous than the GYB form limiter, but still
// protects against runaway loops or scraping.
const dashboardLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
});

// ── Auth routes ────────────────────────────────────────────────────
// 10 per 15 minutes — tight to prevent brute-force password attempts.
// Legitimate users log in once; this limit is never felt.
const authLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
});

// ── OTP rate limiter ───────────────────────────────────────────────
// Very tight — 5 OTP requests per hour per IP.
// Prevents email bombing and brute-force code guessing at the
// request stage. The verify step has its own 5-attempt cap in otp.js.
const otpLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,  // 1 hour
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => req.ip,
  message:         'Too many reset attempts. Please wait an hour and try again.',
});

module.exports = {
  advisorLimiter,
  accountingLimiter,
  roadmapLimiter,
  dataLimiter,
  dashboardLimiter,
  authLimiter,
  otpLimiter,
};
