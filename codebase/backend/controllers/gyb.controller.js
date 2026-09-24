/**
 * controllers/gyb.controller.js
 *
 * Handles the Grow Your Business onboarding flow.
 * ALL four steps go through POST /api/gyb.
 *
 * Step 1 — creates session doc with identity fields
 * Step 2 — updates session with business pulse fields
 * Step 3 — updates session with matchmaking choice
 * Step 4 — receives hashed password + full profile:
 *           1. Writes complete permanent user doc via db.service (DynamoDB)
 *           2. Cleans up temporary session doc
 *           Done. No Firebase Auth involved at signup.
 *           Authentication happens only at login via bcrypt.compare.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');
const { getSubscriptionSummary } = require('../services/subscription.service');
const { v4: uuidv4 }  = require('uuid');
const bcrypt          = require('bcryptjs');
const { signToken, COOKIE_NAME, COOKIE_OPTIONS } = require('../utils/jwt');

const VALID_STAGES    = ['Ideation', 'Launch', 'Scaling', 'Established'];
const VALID_CHANNELS  = ['Social Media', 'Physical Store', 'E-commerce', 'B2B', 'Referrals'];
const VALID_REVENUES  = ['Under ₦500k', '₦500k – ₦2M', '₦2M – ₦10M', 'Over ₦10M'];
const VALID_HEADACHES = [
  'Pricing for Profit',
  'Tracking Cashflow',
  'Accessing Credit/Loans',
  'Managing Staff/Payroll',
];

// ── POST /api/gyb ─────────────────────────────────────────────────
const saveStep = asyncHandler(async (req, res) => {
  const step = parseInt(req.body?.step);

  if (![1, 2, 3, 4].includes(step)) {
    throw ApiError.badRequest('Invalid step. Must be 1, 2, 3, or 4.');
  }

  requireFields(req.body, ['sessionId']);
  const sessionId = req.body.sessionId;

  // ── Step 1 — Identity ─────────────────────────────────────────
  if (step === 1) {
    const body = sanitise(req.body, [
      'fullName', 'businessName', 'email', 'startedAt', 'source',
    ]);
    requireFields(body, ['fullName', 'businessName', 'email']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }

    await firebaseService.createGybSession(sessionId, {
      fullName:     body.fullName.trim(),
      businessName: body.businessName.trim(),
      email:        body.email.toLowerCase().trim(),
      source:       body.source || 'businessrun-gyb',
    });

    return res.json({ success: true, step });
  }

  // ── Step 2 — Business Pulse ───────────────────────────────────
  if (step === 2) {
    const body = sanitise(req.body, [
      'stage', 'salesChannel', 'revenue', 'headache',
    ]);
    requireFields(body, ['stage', 'salesChannel', 'revenue', 'headache']);

    if (!VALID_STAGES.includes(body.stage)) {
      throw ApiError.badRequest(`Invalid stage: "${body.stage}".`);
    }
    // salesChannel may be a comma-separated list of multiple channels
    // (e.g. "Social Media, WhatsApp") — validate each one individually
    const submittedChannels = body.salesChannel
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (submittedChannels.length === 0) {
      throw ApiError.badRequest('At least one sales channel is required.');
    }

    const invalidChannel = submittedChannels.find(c => !VALID_CHANNELS.includes(c));
    if (invalidChannel) {
      throw ApiError.badRequest(`Invalid sales channel: "${invalidChannel}". Valid options: ${VALID_CHANNELS.join(', ')}.`);
    }
    if (!VALID_REVENUES.includes(body.revenue)) {
      throw ApiError.badRequest(`Invalid revenue bracket: "${body.revenue}".`);
    }
    if (!VALID_HEADACHES.includes(body.headache)) {
      throw ApiError.badRequest(`Invalid headache: "${body.headache}".`);
    }

    await firebaseService.updateGybSession(sessionId, {
      stage:          body.stage,
      salesChannel:   body.salesChannel,
      revenue:        body.revenue,
      headache:       body.headache,
      onboardingStep: 2,
    });

    return res.json({ success: true, step });
  }

  // ── Step 3 — Trust & Matchmaking ─────────────────────────────
  if (step === 3) {
    const body = sanitise(req.body, ['matchmaking', 'completedAt']);
    requireFields(body, ['matchmaking']);

    const validMatchmaking = ['Yes, help me scale', "No, I'll manage on my own"];
    if (!validMatchmaking.includes(body.matchmaking)) {
      throw ApiError.badRequest('Invalid matchmaking response.');
    }

    await firebaseService.updateGybSession(sessionId, {
      matchmaking:    body.matchmaking,
      onboardingStep: 3,
    });

    return res.json({ success: true, step });
  }

  // ── Step 4 — Password + Complete Profile ─────────────────────
  // No Firebase Auth. Just write everything via db.service (DynamoDB) and move on.
  // Login verification uses bcrypt.compare against hashedPassword.
  if (step === 4) {
    const body = sanitise(req.body, [
      'email',
      'password',          // plain text — we hash it here on the server
      'fullName',
      'businessName',
      'stage',
      'salesChannel',
      'revenue',
      'headache',
      'matchmaking',
      'profileSavedAt',
      'source',
    ]);

    requireFields(body, ['email', 'password']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }

    if (typeof body.password !== 'string' || body.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters.');
    }

    // Hash the password server-side — plain text never persisted.
    // saltRounds 12 is the production-grade balance of security vs speed.
    const hashedPassword = await bcrypt.hash(body.password, 12);
    const email          = body.email.toLowerCase().trim();

    // ── Multi-tenant identity resolution ─────────────────────────
    // getUserByEmail falls back to matching ANY record with this email —
    // including this very user's own incomplete session doc (uid =
    // sessionId, no hashedPassword) created back in Step 1. That's not
    // a real identity yet, so it's treated the same as "no identity".
    //
    // Three possible cases:
    //   1. No identity at all           → create identity + business + membership
    //   2. Identity exists, UNCLAIMED    → claim it (set password) + business + membership
    //      (this happens if they were invited to a team before ever
    //      registering themselves — accept-invite created a stub identity)
    //   3. Identity exists, CLAIMED      → this is an existing person
    //      registering an ADDITIONAL business. Must prove they own the
    //      account by matching the password they just submitted against
    //      the one already on file — NOT create a second identity.
    const rawExistingIdentity = await firebaseService.getUserByEmail(email);
    // Ignore a match that's actually just THIS signup's own in-progress
    // session doc (uid === sessionId) — it's staged form data from
    // Steps 1-3 of this exact flow, not a genuine pre-existing
    // identity. Treating it as one would mean "claiming" that session
    // row in place, right before the cleanup call below deletes
    // exactly that row by sessionId — destroying the account seconds
    // after creating it.
    const existingIdentity = (rawExistingIdentity && rawExistingIdentity.uid !== sessionId)
      ? rawExistingIdentity
      : null;
    let identityUid;

    if (existingIdentity && existingIdentity.claimed) {
      const passwordMatch = await bcrypt.compare(body.password, existingIdentity.hashedPassword);
      if (!passwordMatch) {
        throw ApiError.unauthorized(
          "An account with this email already exists. Enter that account's password to add this new business, or use a different email."
        );
      }
      identityUid = existingIdentity.uid;
      console.log(`[GYB] Existing identity ${identityUid} registering an additional business`);
    } else if (existingIdentity && !existingIdentity.claimed) {
      identityUid = existingIdentity.uid;
      await firebaseService.updateUserPassword(identityUid, hashedPassword);
      console.log(`[GYB] Claiming previously-unclaimed identity ${identityUid} (${email})`);
    } else {
      identityUid = uuidv4();
      await firebaseService.createIdentity(identityUid, {
        email,
        hashedPassword,
        fullName:  (body.fullName || '').trim(),
        sessionId,
        source:    body.source || 'businessrun-gyb',
      });
    }

    // ── Create the business + the owner membership linking them ─────
    const businessUid = uuidv4();
    await firebaseService.createBusiness(businessUid, {
      businessName: (body.businessName || '').trim(),
      stage:        body.stage        || '',
      salesChannel: body.salesChannel || '',
      revenue:      body.revenue      || '',
      headache:     body.headache     || '',
      matchmaking:  body.matchmaking  || '',
    });

    await firebaseService.createMembership({
      identityUid,
      businessUid,
      role:        'owner',
      permissions: null,      // owner = unrestricted
      status:      'active',
      email,
    });

    // Every new business starts on the same 30-day trial as an
    // existing business would get from the one-time migration —
    // one rule, no special-casing.
    await firebaseService.createSubscription(businessUid);

    console.log(`[GYB] Business created: ${businessUid} for identity ${identityUid} (${email})`);

    // Issue a JWT cookie immediately after signup so the user is
    // logged in as soon as their account is created — no separate
    // login step required. Session is scoped to the business they
    // just created.
    const profileForToken = {
      identityUid,
      businessUid,
      role:         'owner',
      permissions:  null,
      email,
      fullName:     (body.fullName     || '').trim(),
      businessName: (body.businessName || '').trim(),
      stage:        body.stage        || '',
      salesChannel: body.salesChannel || '',
      revenue:      body.revenue      || '',
      headache:     body.headache     || '',
      matchmaking:  body.matchmaking  || '',
    };
    const token = signToken(profileForToken);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Clean up temporary session doc — fire and forget
    firebaseService.deleteGybSession(sessionId)
      .catch(err => console.warn('[GYB] Session cleanup failed:', err.message));

    const { subscription } = await getSubscriptionSummary(businessUid, 'owner');

    return res.status(201).json({
      success: true,
      step,
      // uid here is the person's own identity — not businessUid — same
      // convention as auth.controller.js's publicProfile.
      profile: {
        uid:          identityUid,
        businessUid,
        role:         'owner',
        permissions:  null,
        email,
        fullName:     profileForToken.fullName,
        businessName: profileForToken.businessName,
        stage:        profileForToken.stage,
        salesChannel: profileForToken.salesChannel,
        revenue:      profileForToken.revenue,
        headache:     profileForToken.headache,
        matchmaking:  profileForToken.matchmaking,
      },
      subscription,
    });
  }
});

module.exports = { saveStep };
