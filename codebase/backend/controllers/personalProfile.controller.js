/**
 * controllers/personalProfile.controller.js
 *
 * GET/PATCH for the signed-in personal space's own profile —
 * currently just the display currency, but this is the natural home
 * for any future self-service profile edit (nickname, country, etc.)
 * that isn't part of the onboarding wizard.
 *
 * ── WHY A SEPARATE ENDPOINT FROM ONBOARDING ─────────────────────────
 * personalOnboarding.controller.js only ever runs before a session
 * cookie exists (it's what CREATES the session). Changing the display
 * currency "at will" from inside the dashboard — the actual feature
 * being asked for — needs an authenticated route that works any time
 * after login, which is what this file is for. Mirrors the pattern
 * already established by controllers/team.routes.js's owner-only
 * settings updates: protect → requirePersonalSpace → thin controller.
 *
 * Changing displayCurrency here NEVER rewrites any stored record's
 * own `currency` field (an Account opened in USD stays a USD account)
 * — it only changes what currency GET endpoints convert INTO for
 * display. See personalNetWorth.controller.js's computeTotals and
 * personalAssets.controller.js's getAssets for where that conversion
 * actually happens.
 */

'use strict';

const asyncHandler   = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise }    = require('../utils/sanitise');
const personalService = require('../services/personal.service');
const { CURRENCIES }  = require('../config/personalOptions');

// ── GET /api/personal/profile ───────────────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const space = await personalService.getPersonalSpace(req.user.personalUid);
  if (!space) throw ApiError.notFound('Personal space not found.');

  res.json({
    success: true,
    profile: {
      personalUid:        space.personalUid,
      fullName:            space.fullName,
      nickname:            space.nickname,
      email:               space.email,
      countryOfResidence:  space.countryOfResidence,
      displayCurrency:     space.displayCurrency,
    },
  });
});

// ── PATCH /api/personal/profile ─────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['displayCurrency']);

  if (Object.keys(body).length === 0) {
    throw ApiError.badRequest('Nothing to update. Provide displayCurrency.');
  }

  if (body.displayCurrency && !CURRENCIES.includes(body.displayCurrency)) {
    throw ApiError.badRequest(`Invalid currency: "${body.displayCurrency}".`);
  }

  await personalService.updatePersonalSpace(req.user.personalUid, body);

  res.json({ success: true, displayCurrency: body.displayCurrency });
});

module.exports = { getProfile, updateProfile };
