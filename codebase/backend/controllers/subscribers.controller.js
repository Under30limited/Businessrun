/**
 * controllers/subscribers.controller.js
 *
 * Handles Capital Club signups and resource requests.
 *
 * Routes:
 *   POST /api/subscribe   → Capital Club signup
 *   POST /api/resources   → Resource request (Money-Ready Kit, Pitch Deck etc.)
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');

const VALID_RESOURCES = [
  'Money-Ready Kit',
  'Pitch Deck Template',
];

// ── POST /api/subscribe ───────────────────────────────────────────
// Capital Club signup — email only.
const subscribe = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email', 'subscribedAt', 'source']);
  requireFields(body, ['email']);

  if (!isValidEmail(body.email)) {
    throw ApiError.badRequest('Invalid email address.');
  }

  const email = body.email.toLowerCase().trim();

  // Silent duplicate handling — return success without creating a new doc
  const exists = await firebaseService.subscriberExists(email, 'capital-club');
  if (exists) {
    return res.json({ success: true, duplicate: true });
  }

  const { id } = await firebaseService.createSubscriber({
    email,
    type:   'capital-club',
    source: body.source || 'businessrun-capital-club',
  });

  res.status(201).json({ success: true, id });
});

// ── POST /api/resources ───────────────────────────────────────────
// Resource request — email + resource name.
const requestResource = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['email', 'resource', 'requestedAt', 'source']);
  requireFields(body, ['email', 'resource']);

  if (!isValidEmail(body.email)) {
    throw ApiError.badRequest('Invalid email address.');
  }

  if (!VALID_RESOURCES.includes(body.resource)) {
    throw ApiError.badRequest(
      `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}.`
    );
  }

  const email = body.email.toLowerCase().trim();

  // Allow duplicate resource requests — user may request the same
  // resource more than once (e.g. lost the file). Just create a new record.
  const { id } = await firebaseService.createSubscriber({
    email,
    type:     'resource-request',
    resource: body.resource,
    source:   body.source || 'businessrun-resource-request',
  });

  res.status(201).json({ success: true, id });
});

module.exports = { subscribe, requestResource };
