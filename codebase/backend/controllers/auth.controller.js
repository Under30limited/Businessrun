/**
 * controllers/auth.controller.js
 *
 * Auth endpoints:
 *
 *   POST /api/auth/login            — verify credentials, issue session
 *                                      (or a business picker if the
 *                                      identity has more than one)
 *   POST /api/auth/select-business  — finish login after picking a
 *                                      business (multi-business case)
 *   POST /api/auth/switch-business  — swap which business an already
 *                                      logged-in session is scoped to
 *   POST /api/auth/logout           — clear the JWT cookie
 *   GET  /api/auth/me               — validate current cookie, return
 *                                      fresh profile + available businesses
 *   POST /api/auth/check-email      — GYB step 1 helper
 *
 * ── MULTI-TENANT IDENTITY MODEL ────────────────────────────────────
 * An "identity" (br-users row: email + password) is separate from a
 * "business" (br-businesses row) — one identity can have memberships
 * (br-memberships rows) in more than one business at once: owner of
 * their own, member of someone else's, or several of either.
 *
 * Login therefore has three possible outcomes:
 *   0 active memberships → reject (nothing to log into)
 *   1 active membership  → sign straight into that business (the
 *                            common case — identical UX to before)
 *   2+ active memberships → return a short-lived pre-auth token +
 *                            the list of businesses; the client picks
 *                            one via POST /api/auth/select-business
 *
 * ── PERSONAL WEALTH OS ────────────────────────────────────────────
 * A completely separate space type (see utils/jwt.js's PERSONAL
 * WEALTH OS SESSIONS section) — at most one per identity, single-user,
 * no billing. login() also checks for one and folds it into the same
 * decision tree above, ADDITIVELY: every pure-business outcome above
 * is preserved byte-for-byte (same response shapes, same endpoint
 * names) for every identity that has never touched Personal Wealth
 * OS — which is every identity in production today. A personal space
 * only changes login's behavior once an identity actually has one on
 * file, via POST /api/personal/onboarding.
 *
 * COOKIE STRATEGY (unchanged):
 *   HTTP-only 'br_token' cookie — JS cannot read it, no localStorage,
 *   no XSS token theft, no Authorization header to manage.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const db              = require('../services/db.service');
const personalService = require('../services/personal.service');
const { getSubscriptionSummary } = require('../services/subscription.service');
const { DEFAULT_DISPLAY_CURRENCY } = require('../config/personalOptions');
const bcrypt          = require('bcryptjs');
const {
  signToken, signPreAuthToken, verifyPreAuthToken,
  COOKIE_NAME, COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS,
} = require('../utils/jwt');

// ── personalPublicProfile ────────────────────────────────────────────
// Mirrors publicProfile below, for a Personal Wealth OS session.
function personalPublicProfile(sessionProfile, personalSpace) {
  return {
    uid:      sessionProfile.identityUid,
    personalUid: sessionProfile.personalUid,
    email:    sessionProfile.email,
    fullName: sessionProfile.fullName,
    nickname: sessionProfile.nickname,
    // Optional second arg — the full br-personalSpaces record, when
    // the caller already has it in scope (both call sites below do).
    // Without it, falls back to the platform default rather than
    // omitting the field, so the frontend always gets a currency to
    // render with immediately after login, before its first GET
    // /api/auth/me round trip.
    displayCurrency: personalSpace?.displayCurrency || DEFAULT_DISPLAY_CURRENCY,
  };
}

// ── buildSessionProfile ─────────────────────────────────────────────
// Assembles everything a session needs from an identity + one of its
// memberships: fetches the business's profile fields so the JWT (and
// the response body) can carry businessName/stage/etc without a
// separate DB call on every subsequent request.
async function buildSessionProfile(identity, membership) {
  const business = await db.getBusiness(membership.businessUid);
  return {
    identityUid:  identity.uid,
    businessUid:  membership.businessUid,
    role:         membership.role,
    permissions:  membership.role === 'member' ? (membership.permissions || []) : null,
    email:        identity.email    || '',
    fullName:     identity.fullName || '',
    businessName: business?.businessName || '',
    stage:        business?.stage        || '',
    salesChannel: business?.salesChannel || '',
    revenue:      business?.revenue      || '',
    headache:     business?.headache     || '',
    matchmaking:  business?.matchmaking  || '',
  };
}

// ── publicProfile ────────────────────────────────────────────────────
// What's returned to the frontend in the JSON body. `uid` here is the
// person's own identity — NOT businessUid — so the frontend always
// sees "who is actually logged in", with businessUid/role/permissions
// describing which business this session currently operates on.
function publicProfile(sessionProfile) {
  return {
    uid:          sessionProfile.identityUid,
    businessUid:  sessionProfile.businessUid,
    role:         sessionProfile.role,
    permissions:  sessionProfile.permissions,
    email:        sessionProfile.email,
    fullName:     sessionProfile.fullName,
    businessName: sessionProfile.businessName,
    stage:        sessionProfile.stage,
    salesChannel: sessionProfile.salesChannel,
    revenue:      sessionProfile.revenue,
    headache:     sessionProfile.headache,
    matchmaking:  sessionProfile.matchmaking,
  };
}

// ── listBusinessesForIdentity ────────────────────────────────────────
// Small helper shared by login (business picker) and getMe (switcher).
async function listBusinessesForIdentity(identityUid, currentBusinessUid = null) {
  const memberships = await db.getMembershipsForIdentity(identityUid);
  const active       = memberships.filter(m => m.status === 'active');

  return Promise.all(active.map(async m => {
    const business = await db.getBusiness(m.businessUid);
    return {
      businessUid:  m.businessUid,
      businessName: business?.businessName || '',
      role:         m.role,
      isCurrent:    currentBusinessUid !== null && m.businessUid === currentBusinessUid,
    };
  }));
}

// ── POST /api/auth/login ────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email', 'password']);
  requireFields(body, ['email', 'password']);

  if (!isValidEmail(body.email)) {
    throw ApiError.badRequest('Invalid email address.');
  }

  // 1. Fetch identity by email
  const identity = await db.getUserByEmail(body.email);
  if (!identity || !identity.hashedPassword) {
    // Same message for "not found" and "wrong password" — never reveal
    // which part is wrong (prevents email enumeration).
    throw ApiError.unauthorized('Invalid email or password.');
  }

  // 2. Verify password
  const passwordMatch = await bcrypt.compare(body.password, identity.hashedPassword);
  if (!passwordMatch) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  // 3. Find every business this identity can currently access, AND
  // whether it has a Personal Wealth OS space — see this file's
  // header for why these two stayed completely separate systems for
  // now. A personal space is at most one per identity (enforced at
  // onboarding), so this is a presence check, not a list.
  const memberships = await db.getMembershipsForIdentity(identity.uid);
  const active       = memberships.filter(m => m.status === 'active');

  // Defensive by necessity, not just by style: this call runs on
  // EVERY login, including every existing pure-business one. If
  // br-personalSpaces (or its ownerIdentityUid-index GSI) hasn't been
  // created in DynamoDB yet — e.g. this code deployed slightly ahead
  // of the table provisioning — this must degrade to "no personal
  // space found" rather than take down login platform-wide.
  let personalSpace = null;
  try {
    personalSpace = await personalService.getPersonalSpaceByIdentity(identity.uid);
  } catch (err) {
    console.error('[Auth] login: personal-space lookup failed (treating as none):', err.message);
  }

  if (active.length === 0 && !personalSpace) {
    throw ApiError.forbidden(
      'This account has no business or personal space yet. If you were invited to a team, check your email for the invite link.'
    );
  }

  // 4a. Exactly one business, no personal space — sign straight in,
  // BYTE-IDENTICAL to the behavior before Personal Wealth OS existed.
  // This is deliberately the ONLY path every currently-live business
  // login still takes, until an identity actually has a personal
  // space on file too (impossible before this feature shipped).
  if (active.length === 1 && !personalSpace) {
    const sessionProfile = await buildSessionProfile(identity, active[0]);
    const token = signToken(sessionProfile);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    const { subscription, teamAccessBlocked } = await getSubscriptionSummary(sessionProfile.businessUid, sessionProfile.role);
    return res.json({ success: true, spaceType: 'business', profile: publicProfile(sessionProfile), subscription, teamAccessBlocked });
  }

  // 4b. No business at all, but a personal space — sign straight into
  // it. New path, only reachable by an identity that's been through
  // Personal Wealth OS onboarding and has no business.
  if (active.length === 0 && personalSpace) {
    const sessionProfile = {
      spaceType:   'personal',
      identityUid: identity.uid,
      personalUid: personalSpace.personalUid,
      email:       identity.email,
      fullName:    personalSpace.fullName,
      nickname:    personalSpace.nickname,
    };
    const token = signToken(sessionProfile);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.json({ success: true, spaceType: 'personal', profile: personalPublicProfile(sessionProfile, personalSpace) });
  }

  // 4c. More than one business (with or without a personal space), OR
  // exactly one business PLUS a personal space — more than one place
  // this login could go. Don't set a session cookie yet.
  //
  // Two response shapes on purpose: the ORIGINAL requiresBusinessSelection
  // shape is preserved byte-for-byte for the pure-multi-business case
  // (zero risk to any currently-live multi-business login flow) — the
  // NEW requiresSpaceSelection shape only appears when a personal
  // space is actually part of the choice set, which is impossible for
  // any identity today.
  const businesses    = await listBusinessesForIdentity(identity.uid);
  const preAuthToken = signPreAuthToken(identity.uid);

  if (!personalSpace) {
    return res.json({
      success: true,
      requiresBusinessSelection: true,
      preAuthToken,
      businesses,
    });
  }

  const spaces = [
    ...businesses.map(b => ({ spaceType: 'business', businessUid: b.businessUid, name: b.businessName, role: b.role, isCurrent: b.isCurrent })),
    { spaceType: 'personal', personalUid: personalSpace.personalUid, name: personalSpace.nickname || personalSpace.fullName },
  ];

  return res.json({
    success: true,
    requiresSpaceSelection: true,
    preAuthToken,
    spaces,
  });
});

// ── POST /api/auth/select-space ─────────────────────────────────────
/**
 * The generalized counterpart to select-business, used ONLY when the
 * login picker included a personal space (see requiresSpaceSelection
 * above). select-business remains untouched and still handles every
 * pure-multi-business case exactly as before.
 * Body: { preAuthToken, spaceType, spaceId } — spaceId is a
 * businessUid or personalUid depending on spaceType.
 */
const selectSpace = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['preAuthToken', 'spaceType', 'spaceId']);
  requireFields(body, ['preAuthToken', 'spaceType', 'spaceId']);

  if (!['business', 'personal'].includes(body.spaceType)) {
    throw ApiError.badRequest('spaceType must be "business" or "personal".');
  }

  const { identityUid } = verifyPreAuthToken(body.preAuthToken);

  if (body.spaceType === 'personal') {
    const personalSpace = await personalService.getPersonalSpace(body.spaceId);
    if (!personalSpace || personalSpace.ownerIdentityUid !== identityUid) {
      throw ApiError.forbidden('You do not have access to that personal space.');
    }
    const sessionProfile = {
      spaceType:   'personal',
      identityUid,
      personalUid: personalSpace.personalUid,
      email:       personalSpace.email,
      fullName:    personalSpace.fullName,
      nickname:    personalSpace.nickname,
    };
    const token = signToken(sessionProfile);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.json({ success: true, spaceType: 'personal', profile: personalPublicProfile(sessionProfile, personalSpace) });
  }

  const identity = await db.getUserByUid(identityUid);
  if (!identity) throw ApiError.unauthorized('Session expired. Please log in again.');

  const membership = await db.getMembership(identityUid, body.spaceId);
  if (!membership || membership.status !== 'active') {
    throw ApiError.forbidden('You do not have active access to that business.');
  }

  const sessionProfile = await buildSessionProfile(identity, membership);
  const token = signToken(sessionProfile);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const { subscription, teamAccessBlocked } = await getSubscriptionSummary(sessionProfile.businessUid, sessionProfile.role);
  res.json({ success: true, spaceType: 'business', profile: publicProfile(sessionProfile), subscription, teamAccessBlocked });
});

// ── POST /api/auth/select-business ──────────────────────────────────
/**
 * Second step of login for an identity with multiple active
 * memberships. Body: { preAuthToken, businessUid }.
 */
const selectBusiness = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['preAuthToken', 'businessUid']);
  requireFields(body, ['preAuthToken', 'businessUid']);

  const { identityUid } = verifyPreAuthToken(body.preAuthToken);

  const identity = await db.getUserByUid(identityUid);
  if (!identity) throw ApiError.unauthorized('Session expired. Please log in again.');

  const membership = await db.getMembership(identityUid, body.businessUid);
  if (!membership || membership.status !== 'active') {
    throw ApiError.forbidden('You do not have active access to that business.');
  }

  const sessionProfile = await buildSessionProfile(identity, membership);
  const token = signToken(sessionProfile);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const { subscription, teamAccessBlocked } = await getSubscriptionSummary(sessionProfile.businessUid, sessionProfile.role);
  res.json({ success: true, profile: publicProfile(sessionProfile), subscription, teamAccessBlocked });
});

// ── POST /api/auth/switch-business ──────────────────────────────────
/**
 * For an ALREADY logged-in session — swap which business the session
 * is scoped to, without re-entering a password. Body: { businessUid }.
 * Requires the `protect` middleware (see routes/auth.routes.js).
 */
const switchBusiness = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['businessUid']);
  requireFields(body, ['businessUid']);

  const identity = await db.getUserByUid(req.user.identityUid);
  if (!identity) throw ApiError.unauthorized('Session invalid. Please log in again.');

  const membership = await db.getMembership(req.user.identityUid, body.businessUid);
  if (!membership || membership.status !== 'active') {
    throw ApiError.forbidden('You do not have active access to that business.');
  }

  const sessionProfile = await buildSessionProfile(identity, membership);
  const token = signToken(sessionProfile);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const { subscription, teamAccessBlocked } = await getSubscriptionSummary(sessionProfile.businessUid, sessionProfile.role);
  res.json({ success: true, profile: publicProfile(sessionProfile), subscription, teamAccessBlocked });
});

// ── POST /api/auth/logout ────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────
/**
 * Returns the current session's profile (from the JWT — no DB call for
 * that part) plus the list of businesses this identity can switch to
 * (one DB query — used to power a business switcher in the UI; safe
 * to ignore when it comes back with length <= 1).
 */
const getMe = asyncHandler(async (req, res) => {
  // ── Personal Wealth OS session ───────────────────────────────────
  if (req.user.spaceType === 'personal') {
    let personalSpace = null;
    try {
      personalSpace = await personalService.getPersonalSpace(req.user.personalUid);
    } catch (err) {
      console.error('[Auth] getMe: failed to load personal space:', err.message);
    }

    return res.json({
      success: true,
      spaceType: 'personal',
      profile: {
        uid:         req.user.identityUid,
        personalUid: req.user.personalUid,
        email:       req.user.email,
        fullName:    req.user.fullName,
        nickname:    req.user.nickname,
        // Richer onboarding-questionnaire fields, fetched fresh here
        // rather than embedded in the (deliberately lean) token — see
        // utils/jwt.js's PERSONAL WEALTH OS SESSIONS section.
        countryOfResidence:       personalSpace?.countryOfResidence       || '',
        phoneNumber:              personalSpace?.phoneNumber              || '',
        gender:                   personalSpace?.gender                   || '',
        primaryIncomeSource:      personalSpace?.primaryIncomeSource      || '',
        assetLocations:           personalSpace?.assetLocations           || [],
        monthlyIncomeBracket:     personalSpace?.monthlyIncomeBracket     || '',
        biggestFinancialHeadache: personalSpace?.biggestFinancialHeadache || '',
        wantsWealthOpportunities: Boolean(personalSpace?.wantsWealthOpportunities),
        // The dashboard's display currency (changeable at will via
        // PATCH /api/personal/profile — see
        // personalProfile.controller.js) — fetched fresh, same as the
        // fields above, so a currency change made in one tab/device
        // is picked up the next time this session is restored
        // anywhere, rather than being frozen at whatever it was when
        // this JWT was issued.
        displayCurrency:          personalSpace?.displayCurrency         || DEFAULT_DISPLAY_CURRENCY,
      },
      // No subscription/teamAccessBlocked — Personal Wealth OS has no
      // billing yet (see the build discussion). Omitted rather than
      // sent as null-shaped fake data the frontend might misread as
      // "on the free tier of something."
    });
  }

  const profile = {
    uid:          req.user.identityUid,
    businessUid:  req.user.businessUid,
    role:         req.user.role,
    permissions:  req.user.permissions,
    email:        req.user.email,
    fullName:     req.user.fullName,
    businessName: req.user.businessName,
    stage:        req.user.stage,
    salesChannel: req.user.salesChannel,
    revenue:      req.user.revenue,
    headache:     req.user.headache,
    matchmaking:  req.user.matchmaking,
  };

  let availableBusinesses = [];
  try {
    availableBusinesses = await listBusinessesForIdentity(req.user.identityUid, req.user.businessUid);
  } catch (err) {
    // Never fail the whole /me call over this — it's a UI nicety, not
    // required for the session itself to be valid.
    console.error('[Auth] getMe: failed to load available businesses:', err.message);
  }

  // ── Subscription summary ─────────────────────────────────────────
  // Computed once via the shared helper so every frontend popup/
  // banner/gate reads from the same source of truth as login itself.
  let subscription      = null;
  let teamAccessBlocked = false;

  try {
    ({ subscription, teamAccessBlocked } = await getSubscriptionSummary(req.user.uid, req.user.role));
  } catch (err) {
    console.error('[Auth] getMe: failed to load subscription info:', err.message);
  }

  res.json({ success: true, spaceType: 'business', profile, availableBusinesses, subscription, teamAccessBlocked });
});

// ── POST /api/auth/check-email ───────────────────────────────────────
/**
 * Email check used during GYB signup Step 1.
 *
 * ── WHAT CHANGED WITH MULTI-TENANCY ────────────────────────────────
 * `claimed: true` used to mean "block signup, tell them to log in
 * instead." It no longer does — an existing identity is now perfectly
 * able to register an ADDITIONAL business (GYB step 4 verifies their
 * password matches before doing so). `claimed` is informational only:
 * the frontend can use it to say "you already have an account — enter
 * your existing password to add this new business" instead of
 * treating it as a hard stop. See gyb.controller.js step 4.
 *
 * Body:    { email }
 * Response: { success: true, exists: boolean, claimed: boolean }
 */
const checkEmail = asyncHandler(async (req, res) => {
  const body  = sanitise(req.body, ['email']);
  requireFields(body, ['email']);

  const email = body.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw ApiError.badRequest('Invalid email address.');

  let exists  = false;
  let claimed = false;

  try {
    const identity = await db.getUserByEmail(email);
    if (identity) {
      exists  = true;
      claimed = identity.claimed === true;
    }
  } catch {
    exists  = false;
    claimed = false;
  }

  res.json({ success: true, exists, claimed });
});

module.exports = { login, selectBusiness, selectSpace, switchBusiness, logout, getMe, checkEmail };
