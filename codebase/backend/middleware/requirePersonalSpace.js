/**
 * middleware/requirePersonalSpace.js
 *
 * Rejects a request unless it's carrying a Personal Wealth OS session
 * (spaceType: 'personal') — the mirror image of every business route
 * implicitly assuming a business session. Use AFTER `protect` on every
 * /api/personal/* route (except onboarding, which has no session yet):
 *
 *   router.get('/assets', protect, requirePersonalSpace, controller.list);
 *
 * Without this, a business-session token reaching a personal-finance
 * controller would have req.user.uid pointing at a businessUid, which
 * that controller would silently (and incorrectly) treat as a
 * personalUid — this middleware turns that into a clear 403 instead.
 */

'use strict';

const ApiError = require('../utils/ApiError');

function requirePersonalSpace(req, res, next) {
  if (!req.user || req.user.spaceType !== 'personal') {
    throw ApiError.forbidden('This endpoint is only available for a Personal Wealth OS session.');
  }
  next();
}

module.exports = { requirePersonalSpace };
