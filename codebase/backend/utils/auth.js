/**
 * middleware/auth.js
 *
 * Verifies a session JWT and attaches the decoded user profile to req.user.
 *
 * TOKEN SOURCE — checked in this order:
 *   1. HTTP-only cookie named 'br_token'  (primary — set by login/signup)
 *   2. Authorization: Bearer <token>      (fallback — for API clients / Postman)
 *
 * WHY HTTP-ONLY COOKIE AS PRIMARY:
 *   The cookie is set with HttpOnly, Secure, and SameSite=Strict flags.
 *   This means:
 *   - JavaScript on the page CANNOT read it (blocks XSS token theft)
 *   - It is ONLY sent over HTTPS in production (blocks network sniffing)
 *   - It is NEVER sent on cross-site requests (blocks CSRF)
 *   - The browser sends it automatically on every request — no JS needed
 *
 * WHAT req.user CONTAINS AFTER THIS MIDDLEWARE:
 *   {
 *     uid:          string,
 *     email:        string,
 *     fullName:     string,
 *     businessName: string,
 *     stage:        string,
 *     salesChannel: string,
 *     revenue:      string,
 *     headache:     string,
 *     matchmaking:  string,
 *   }
 *
 * USAGE:
 *   const { protect, optionalAuth } = require('../middleware/auth');
 *   router.get('/me', protect, controller.getMe);
 *   router.post('/advisor', optionalAuth, controller.ask);
 */

'use strict';

const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const ApiError                     = require('../utils/ApiError');
const asyncHandler                 = require('../utils/asyncHandler');

// ── extractToken ──────────────────────────────────────────────────
function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    if (token) return token;
  }
  return null;
}

// ── protect ───────────────────────────────────────────────────────
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('No session found. Please log in to continue.');
  }
  const payload = verifyToken(token);
  req.user = {
    uid:          payload.uid,
    identityUid:  payload.identityUid  ?? payload.uid,
    businessUid:  payload.businessUid  ?? payload.uid,
    role:         payload.role         || 'owner',
    permissions:  payload.permissions  ?? null,
    email:        payload.email,
    fullName:     payload.fullName,
    businessName: payload.businessName,
    stage:        payload.stage,
    salesChannel: payload.salesChannel,
    revenue:      payload.revenue,
    headache:     payload.headache,
    matchmaking:  payload.matchmaking,
  };
  next();
});

// ── optionalAuth ──────────────────────────────────────────────────
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifyToken(token);
    req.user = {
      uid:          payload.uid,
      identityUid:  payload.identityUid  ?? payload.uid,
      businessUid:  payload.businessUid  ?? payload.uid,
      role:         payload.role         || 'owner',
      permissions:  payload.permissions  ?? null,
      email:        payload.email,
      fullName:     payload.fullName,
      businessName: payload.businessName,
      stage:        payload.stage,
      salesChannel: payload.salesChannel,
      revenue:      payload.revenue,
      headache:     payload.headache,
      matchmaking:  payload.matchmaking,
    };
  } catch {
    req.user = null;
  }
  next();
});

module.exports = { protect, optionalAuth };
