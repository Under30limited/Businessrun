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
 *   Business session (spaceType: 'business', the default for tokens
 *   signed before Personal Wealth OS existed):
 *   {
 *     uid, spaceType: 'business', identityUid, businessUid, role,
 *     permissions, email, fullName, businessName, stage,
 *     salesChannel, revenue, headache, matchmaking,
 *   }
 *
 *   Personal Wealth OS session (spaceType: 'personal'):
 *   {
 *     uid, spaceType: 'personal', identityUid, personalUid,
 *     role: 'owner', email, fullName, nickname,
 *   }
 *   Personal-space routes should use requirePersonalSpace (see
 *   middleware/requirePersonalSpace.js) in addition to protect, to
 *   reject a business-session token reaching them and vice versa.
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

// ── buildReqUser ──────────────────────────────────────────────────
// Shared by protect/optionalAuth so the business-vs-personal branch
// only has to be written once. `payload.spaceType` is absent on
// every token signed before Personal Wealth OS existed — treated as
// 'business' here, matching that this middleware's original,
// business-only shape stays the exact default for all of them.
function buildReqUser(payload) {
  if (payload.spaceType === 'personal') {
    return {
      uid:         payload.uid,
      spaceType:   'personal',
      identityUid: payload.identityUid ?? payload.uid,
      personalUid: payload.personalUid ?? payload.uid,
      role:        'owner',
      email:       payload.email,
      fullName:    payload.fullName,
      nickname:    payload.nickname,
    };
  }

  return {
    uid:          payload.uid,
    spaceType:    'business',
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
}

// ── protect ───────────────────────────────────────────────────────
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('No session found. Please log in to continue.');
  }
  req.user = buildReqUser(verifyToken(token));
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
    req.user = buildReqUser(verifyToken(token));
  } catch {
    req.user = null;
  }
  next();
});

module.exports = { protect, optionalAuth };
