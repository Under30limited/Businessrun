/**
 * controllers/personalOnboarding.controller.js
 *
 * Handles the Personal Wealth OS onboarding flow — mirrors
 * gyb.controller.js's structure deliberately (same session-staging
 * pattern, same step dispatch, same identity-claiming logic at the
 * final step), but writes to br-personalSpaces via
 * services/personal.service.js instead of br-businesses.
 *
 * ALL four steps go through POST /api/personal/onboarding.
 *
 * Step 1 — The Basics (fullName, nickname, email, country, phone,
 *          displayCurrency — the currency every dashboard screen
 *          shows totals in until changed later; see
 *          personalProfile.controller.js)
 * Step 2 — Financial Profile (income source, asset locations, income
 *          bracket, biggest financial headache)
 * Step 3 — Wealth Discovery & Match (wantsWealthOpportunities opt-in)
 * Step 4 — Security & Launch (gender, password) → creates the real
 *          identity (or reuses/claims an existing one — see below)
 *          and the personal space, then logs the user straight in.
 *
 * ── IDENTITY HANDLING AT STEP 4 ──────────────────────────────────
 * Identical three-case logic to GYB's step 4, because the identity
 * layer is genuinely shared between business and personal — see
 * utils/jwt.js's PERSONAL WEALTH OS SESSIONS section:
 *   1. No identity at all         → create identity + personal space
 *   2. Identity exists, UNCLAIMED  → claim it (set password) + space
 *      (can happen if this email was invited to a business team
 *      before ever going through either signup flow)
 *   3. Identity exists, CLAIMED    → this is an existing person (with
 *      a business account, or a personal space from before, or both)
 *      wanting to ALSO get a personal space. Must prove they own the
 *      account by matching the password submitted here against the
 *      one already on file — never silently reuse an identity without
 *      that check.
 *
 * One thing GYB's step 4 does NOT need to check, that this does:
 * Personal Wealth OS is single-user, one space per identity — see
 * config/personalOptions.js. If this identity already has a personal
 * space, step 4 rejects clearly rather than silently creating a
 * second one that the login picker would never surface correctly.
 */

'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const db             = require('../services/db.service');       // shared identity table only (getUserByEmail/createIdentity/updateUserPassword)
const personalService = require('../services/personal.service');
const { v4: uuidv4 } = require('uuid');
const bcrypt         = require('bcryptjs');
const { signToken, COOKIE_NAME, COOKIE_OPTIONS } = require('../utils/jwt');
const {
  PRIMARY_INCOME_SOURCES, ASSET_LOCATIONS, MONTHLY_INCOME_BRACKETS,
  FINANCIAL_HEADACHES, GENDER_OPTIONS, CURRENCIES, DEFAULT_DISPLAY_CURRENCY,
} = require('../config/personalOptions');

// ── POST /api/personal/onboarding ───────────────────────────────────
const saveStep = asyncHandler(async (req, res) => {
  const step = parseInt(req.body?.step);

  if (![1, 2, 3, 4].includes(step)) {
    throw ApiError.badRequest('Invalid step. Must be 1, 2, 3, or 4.');
  }

  requireFields(req.body, ['sessionId']);
  const sessionId = req.body.sessionId;

  // ── Step 1 — The Basics ─────────────────────────────────────────
  if (step === 1) {
    const body = sanitise(req.body, [
      'fullName', 'nickname', 'email', 'countryOfResidence', 'phoneNumber', 'displayCurrency',
    ]);
    requireFields(body, ['fullName', 'nickname', 'email', 'countryOfResidence', 'displayCurrency']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }
    if (!CURRENCIES.includes(body.displayCurrency)) {
      throw ApiError.badRequest(`Invalid currency: "${body.displayCurrency}".`);
    }

    await personalService.createOnboardingSession(sessionId, {
      fullName:           body.fullName.trim(),
      nickname:           body.nickname.trim(),
      email:              body.email.toLowerCase().trim(),
      countryOfResidence: body.countryOfResidence.trim(),
      phoneNumber:        (body.phoneNumber || '').trim(),
      displayCurrency:    body.displayCurrency,
    });

    return res.json({ success: true, step });
  }

  // ── Step 2 — Financial Profile ──────────────────────────────────
  if (step === 2) {
    const body = sanitise(req.body, [
      'primaryIncomeSource', 'assetLocations', 'monthlyIncomeBracket', 'biggestFinancialHeadache',
    ]);
    requireFields(body, ['primaryIncomeSource', 'assetLocations', 'monthlyIncomeBracket', 'biggestFinancialHeadache']);

    if (!PRIMARY_INCOME_SOURCES.includes(body.primaryIncomeSource)) {
      throw ApiError.badRequest(`Invalid income source: "${body.primaryIncomeSource}".`);
    }

    // assetLocations is multi-select — accept either a real array or
    // a comma-separated string (same tolerance GYB gives salesChannel).
    const submittedLocations = Array.isArray(body.assetLocations)
      ? body.assetLocations
      : String(body.assetLocations).split(',').map(l => l.trim()).filter(Boolean);

    if (submittedLocations.length === 0) {
      throw ApiError.badRequest('Select at least one place you hold money or assets.');
    }
    const invalidLocation = submittedLocations.find(l => !ASSET_LOCATIONS.includes(l));
    if (invalidLocation) {
      throw ApiError.badRequest(`Invalid asset location: "${invalidLocation}".`);
    }

    if (!MONTHLY_INCOME_BRACKETS.includes(body.monthlyIncomeBracket)) {
      throw ApiError.badRequest(`Invalid income bracket: "${body.monthlyIncomeBracket}".`);
    }
    if (!FINANCIAL_HEADACHES.includes(body.biggestFinancialHeadache)) {
      throw ApiError.badRequest(`Invalid financial headache: "${body.biggestFinancialHeadache}".`);
    }

    await personalService.updateOnboardingSession(sessionId, {
      primaryIncomeSource:      body.primaryIncomeSource,
      assetLocations:           submittedLocations,
      monthlyIncomeBracket:     body.monthlyIncomeBracket,
      biggestFinancialHeadache: body.biggestFinancialHeadache,
      onboardingStep: 2,
    });

    return res.json({ success: true, step });
  }

  // ── Step 3 — Wealth Discovery & Match ───────────────────────────
  if (step === 3) {
    const body = sanitise(req.body, ['wantsWealthOpportunities']);
    requireFields(body, ['wantsWealthOpportunities']);

    // Stored as a plain preference flag only — no recommendation
    // engine or third-party data sharing exists behind this yet (see
    // the build discussion). Never treat this as unlocking any
    // feature; it's informational until something is actually built.
    await personalService.updateOnboardingSession(sessionId, {
      wantsWealthOpportunities: Boolean(body.wantsWealthOpportunities),
      onboardingStep: 3,
    });

    return res.json({ success: true, step });
  }

  // ── Step 4 — Security & Launch ──────────────────────────────────
  if (step === 4) {
    const body = sanitise(req.body, ['email', 'password', 'gender']);
    requireFields(body, ['email', 'password', 'gender']);

    if (!isValidEmail(body.email)) {
      throw ApiError.badRequest('Invalid email address.');
    }
    if (typeof body.password !== 'string' || body.password.length < 6) {
      throw ApiError.badRequest('Password must be at least 6 characters.');
    }
    if (!GENDER_OPTIONS.includes(body.gender)) {
      throw ApiError.badRequest(`Invalid gender option: "${body.gender}".`);
    }

    const email = body.email.toLowerCase().trim();

    const session = await personalService.getOnboardingSession(sessionId);
    if (!session) {
      throw ApiError.badRequest('Your onboarding session expired or was not found. Please start again from Step 1.');
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);

    // ── Multi-tenant identity resolution — see file header ──────────
    const existingIdentity = await db.getUserByEmail(email);
    let identityUid;

    if (existingIdentity && existingIdentity.claimed) {
      const passwordMatch = await bcrypt.compare(body.password, existingIdentity.hashedPassword);
      if (!passwordMatch) {
        throw ApiError.unauthorized(
          "An account with this email already exists. Enter that account's password to add a Personal Wealth space, or use a different email."
        );
      }
      identityUid = existingIdentity.uid;
      console.log(`[PersonalOnboarding] Existing identity ${identityUid} adding a Personal Wealth space`);
    } else if (existingIdentity && !existingIdentity.claimed) {
      identityUid = existingIdentity.uid;
      await db.updateUserPassword(identityUid, hashedPassword);
      console.log(`[PersonalOnboarding] Claiming previously-unclaimed identity ${identityUid} (${email})`);
    } else {
      identityUid = uuidv4();
      await db.createIdentity(identityUid, {
        email,
        hashedPassword,
        fullName: session.fullName || '',
        source:   'personal-wealth-onboarding',
      });
    }

    // ── One personal space per identity — see file header ───────────
    const existingSpace = await personalService.getPersonalSpaceByIdentity(identityUid);
    if (existingSpace) {
      throw ApiError.badRequest('This account already has a Personal Wealth space. Please log in instead.');
    }

    const personalUid = uuidv4();
    await personalService.createPersonalSpace(personalUid, identityUid, {
      fullName:                 session.fullName,
      nickname:                 session.nickname,
      email,
      countryOfResidence:       session.countryOfResidence,
      phoneNumber:              session.phoneNumber,
      gender:                   body.gender,
      primaryIncomeSource:      session.primaryIncomeSource,
      assetLocations:           session.assetLocations,
      monthlyIncomeBracket:     session.monthlyIncomeBracket,
      biggestFinancialHeadache: session.biggestFinancialHeadache,
      wantsWealthOpportunities: session.wantsWealthOpportunities,
      displayCurrency:          session.displayCurrency || DEFAULT_DISPLAY_CURRENCY,
    });

    console.log(`[PersonalOnboarding] Personal space created: ${personalUid} for identity ${identityUid} (${email})`);

    // Log in immediately — same UX principle as GYB.
    const token = signToken({
      spaceType: 'personal',
      identityUid,
      personalUid,
      email,
      fullName: session.fullName,
      nickname: session.nickname,
    });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Clean up the staging session — fire and forget, same as GYB.
    personalService.deleteOnboardingSession(sessionId)
      .catch(err => console.warn('[PersonalOnboarding] Session cleanup failed:', err.message));

    return res.status(201).json({
      success: true,
      step,
      spaceType: 'personal',
      profile: {
        uid: identityUid,
        personalUid,
        email,
        fullName: session.fullName,
        nickname: session.nickname,
        displayCurrency: session.displayCurrency || DEFAULT_DISPLAY_CURRENCY,
      },
    });
  }
});

module.exports = { saveStep };
