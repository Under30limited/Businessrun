/**
 * utils/jwt.js
 *
 * Sign and verify JSON Web Tokens for BusinessRun session management.
 *
 * WHY JWT (not just cookies with profile data):
 *   A cookie holding raw profile JSON could be tampered with by anyone
 *   who edits their browser storage — they could set businessName to
 *   anything, or worse, forge a uid. A JWT is cryptographically signed
 *   with a secret only the server knows. If anyone tampers with the
 *   payload, the signature no longer matches and the server rejects it.
 *
 * ── MULTI-TENANT IDENTITY MODEL ────────────────────────────────────
 * One person (one login identity) can belong to more than one business
 * — they might own their own business AND be an invited team member on
 * someone else's. So a session token has to carry TWO different ids:
 *
 *   identityUid — who is actually logged in (their own account, fixed
 *                 no matter which business they're currently viewing).
 *   businessUid — which business's data this session is scoped to
 *                 right now. This is what gets put in `uid` in the
 *                 payload, because every existing controller scopes
 *                 its DynamoDB queries by `req.user.uid` — keeping
 *                 that name means zero changes to any of those
 *                 controllers, whether uid happens to equal
 *                 identityUid (the common case: someone with exactly
 *                 one business) or not (a team member operating on an
 *                 owner's business, or someone who owns multiple
 *                 businesses and is currently viewing a non-default one).
 *
 * For a person with exactly one business, identityUid === businessUid
 * === uid, so nothing about existing behavior changes.
 *
 * WHAT IS STORED IN THE TOKEN:
 *   uid          — CURRENT business/data scope (see above)
 *   identityUid  — the real logged-in identity
 *   businessUid  — explicit alias of uid, for team/business-switch code
 *   role         — 'owner' | 'member', for THIS business
 *   permissions  — feature keys for THIS business if role is 'member',
 *                  else null (owner = unrestricted)
 *   email, fullName, businessName, stage, salesChannel, revenue,
 *   headache, matchmaking — profile fields for RoadmapPage to render
 *   immediately without a DB round-trip
 *
 *   No password, no sensitive data, no payment info.
 *
 * TOKEN LIFETIME:
 *   ACCESS TOKEN    — 7 days (JWT_EXPIRES_IN env var, default '7d').
 *     Stored in an HTTP-only, Secure, SameSite cookie.
 *   PRE-AUTH TOKEN  — 5 minutes. Issued by POST /api/auth/login instead
 *     of a session cookie when an identity has MORE THAN ONE active
 *     business membership — the client must call
 *     POST /api/auth/select-business with this token plus the chosen
 *     businessUid to get the real session cookie. It is NOT set as a
 *     cookie — returned in the JSON body only, and carries no business
 *     data at all (just identityUid + a purpose flag), so it can't be
 *     used to access anything by itself.
 *   PAYMENT TOKEN   — 1 hour. Issued by POST /api/payments/initialize,
 *     set as its OWN separate httpOnly cookie (br_pmt_token), bound to
 *     one specific transaction reference + businessUid. Exists purely
 *     to bridge the Paystack checkout window (card entry/OTP/3D Secure
 *     can take several minutes) safely — see controllers/payments.
 *     controller.js's verify() for how it's used. Deliberately NOT the
 *     same token/cookie as the login session: its only job is proving
 *     "this browser is the one that started THIS checkout," which
 *     must keep working even if the unrelated 7-day login session
 *     happens to expire in the same window, and must NOT be usable
 *     for anything else a real session grants.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   JWT_SECRET      — long random string (min 32 chars). Generate with:
 *                     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 *   JWT_EXPIRES_IN  — optional, defaults to '7d'
 *
 * USAGE:
 *   const { signToken, verifyToken, signPreAuthToken, verifyPreAuthToken } = require('../utils/jwt');
 *   const token = signToken(profile);                // sign a full session
 *   const payload = verifyToken(token);               // verify → payload or throws
 *   const preAuth = signPreAuthToken(identityUid);     // multi-business login step 1
 *   const { identityUid } = verifyPreAuthToken(preAuth); // multi-business login step 2
 */

'use strict';

const jwt      = require('jsonwebtoken');
const ApiError = require('./ApiError');

// ── Guard: fail loudly at startup if secret is missing ────────────
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      '[JWT] JWT_SECRET is not set or is too short (need ≥ 32 chars). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
  return secret;
}

// ── Cookie configuration ──────────────────────────────────────────
const COOKIE_NAME = 'br_token';

// No Domain attribute = a "host-only" cookie, valid for the EXACT
// hostname that issued it — thebusinessrun.com and
// www.thebusinessrun.com are different hosts under that rule, even
// though config/corsOptions.js treats both as the same allowed site.
// That mismatch is what broke the post-payment redirect: a user
// logged in on www.thebusinessrun.com had br_token/br_pmt_token
// scoped to www only, but controllers/payments.controller.js's
// Paystack callback_url always points at the bare APP_URL host — so
// neither cookie was ever sent back on return, and the app looked
// logged out immediately after a successful payment.
//
// Setting an explicit leading-dot domain makes the cookie valid for
// thebusinessrun.com AND all its subdomains, matching what CORS
// already assumes is "the same site". Only applied in production —
// in development this must stay undefined, since a cookie scoped to
// .thebusinessrun.com is simply rejected by the browser when the app
// is actually running on localhost.
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production'
  ? (process.env.COOKIE_DOMAIN || '.thebusinessrun.com')
  : undefined;

const COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'lax',
  domain:    COOKIE_DOMAIN,
  maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days
  path:      '/',
};

const CLEAR_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge:  0,
  expires: new Date(0),
};

// ── Payment token cookie configuration ─────────────────────────────
// Separate cookie from the login session (br_token) — see file header.
// Same httpOnly/secure/sameSite posture (needs sameSite: 'lax' for the
// same reason br_token does: it must survive a top-level GET redirect
// back from Paystack's domain to ours), but a much shorter lifetime
// and scoped to a single path so it isn't sent on every request.
// Same COOKIE_DOMAIN as br_token above, and for the identical reason
// — this cookie is minted right before redirecting to Paystack, so
// it's just as exposed to the www-vs-bare-domain mismatch as the
// login cookie is.
const PAYMENT_COOKIE_NAME = 'br_pmt_token';

const PAYMENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  domain:   COOKIE_DOMAIN,
  maxAge:   60 * 60 * 1000, // 1 hour — generous for slow checkout, short-lived on purpose
  path:     '/api/payments',
};

const PAYMENT_COOKIE_CLEAR_OPTIONS = {
  ...PAYMENT_COOKIE_OPTIONS,
  maxAge:  0,
  expires: new Date(0),
};

// ── signToken ─────────────────────────────────────────────────────
/**
 * Signs a full session JWT.
 * Called on login (single-business case), POST /api/auth/select-business,
 * POST /api/auth/switch-business, GYB signup (step 4), and accept-invite.
 *
 * @param {Object} profile
 * @param {string} profile.identityUid   the real logged-in identity
 * @param {string} profile.businessUid   which business this session is scoped to
 * @param {string} [profile.role]        'owner' | 'member' — defaults 'owner'
 * @param {string[]|null} [profile.permissions]  feature keys, null = all (owner)
 * @returns {string}
 */
function signToken(profile) {
  const secret = getSecret();

  const identityUid = profile.identityUid || profile.uid || '';
  const businessUid = profile.businessUid || profile.uid || '';
  const role        = profile.role        || 'owner';

  const payload = {
    uid:          businessUid,           // current business/data scope
    identityUid,
    businessUid,
    role,
    permissions:  profile.permissions ?? null,
    email:        profile.email        || '',
    fullName:     profile.fullName     || '',
    businessName: profile.businessName || '',
    stage:        profile.stage        || '',
    salesChannel: profile.salesChannel || '',
    revenue:      profile.revenue      || '',
    headache:     profile.headache     || '',
    matchmaking:  profile.matchmaking  || '',
  };

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });
}

// ── verifyToken ───────────────────────────────────────────────────
/**
 * Verifies a full session JWT and returns its payload.
 * Throws ApiError 401 if missing, malformed, expired, or tampered with.
 *
 * @param {string} token
 * @returns {Object} Decoded payload { uid, identityUid, businessUid, role, permissions, ... }
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid session token. Please log in again.');
  }
}

// ── signPreAuthToken / verifyPreAuthToken ─────────────────────────
/**
 * Short-lived (5 min) token used ONLY for the multi-business login
 * handshake. Carries nothing but identityUid and a purpose marker —
 * it cannot be used as a session token (verifyToken's callers all
 * expect businessUid/role/permissions, which this deliberately omits).
 *
 * @param {string} identityUid
 * @returns {string}
 */
function signPreAuthToken(identityUid) {
  const secret = getSecret();
  return jwt.sign(
    { identityUid, purpose: 'select-business' },
    secret,
    { expiresIn: '5m', algorithm: 'HS256' }
  );
}

/**
 * @param {string} token
 * @returns {{ identityUid: string }}
 * @throws {ApiError} 401 if invalid/expired/wrong purpose
 */
function verifyPreAuthToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  } catch {
    throw ApiError.unauthorized('This login attempt has expired. Please log in again.');
  }
  if (payload.purpose !== 'select-business' || !payload.identityUid) {
    throw ApiError.unauthorized('Invalid login token.');
  }
  return { identityUid: payload.identityUid };
}

/**
 * signPaymentToken
 * Minted at checkout start (POST /api/payments/initialize), bound to
 * one specific transaction reference + businessUid. Set as its own
 * cookie (PAYMENT_COOKIE_NAME) — see file header for why this is
 * separate from the login session.
 *
 * @param {string} reference    the exact transaction reference this
 *                                token is allowed to confirm
 * @param {string} businessUid  which business this payment belongs to
 * @returns {string}
 */
function signPaymentToken(reference, businessUid) {
  const secret = getSecret();
  return jwt.sign(
    { reference, businessUid, purpose: 'payment-confirm' },
    secret,
    { expiresIn: '1h', algorithm: 'HS256' }
  );
}

/**
 * verifyPaymentToken
 * Soft check, unlike verifyToken/verifyPreAuthToken — returns null on
 * ANY failure (missing, malformed, expired, wrong purpose) instead of
 * throwing, because callers treat this as "do we happen to have extra
 * trust for this browser," not a hard authentication requirement.
 *
 * @param {string} token
 * @returns {{ reference: string, businessUid: string }|null}
 */
function verifyPaymentToken(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (payload.purpose !== 'payment-confirm' || !payload.reference || !payload.businessUid) {
    return null;
  }
  return { reference: payload.reference, businessUid: payload.businessUid };
}

module.exports = {
  COOKIE_NAME,
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  PAYMENT_COOKIE_NAME,
  PAYMENT_COOKIE_OPTIONS,
  PAYMENT_COOKIE_CLEAR_OPTIONS,
  signToken,
  verifyToken,
  signPreAuthToken,
  verifyPreAuthToken,
  signPaymentToken,
  verifyPaymentToken,
};
