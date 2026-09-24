/**
 * controllers/contact.controller.js
 *
 * POST /api/contact — the one endpoint behind "lay a complaint / drop
 * a suggestion" on all three surfaces (home page, Business OS,
 * Personal Wealth OS). Sits behind optionalAuth (see routes/
 * contact.routes.js), which already knows how to decode both a
 * business session and a Personal Wealth OS session — see
 * middleware/auth.js's buildReqUser — and sets req.user = null for
 * an anonymous home-page visitor. That's what makes one shared
 * implementation possible instead of three parallel ones.
 *
 * TRUST MODEL:
 *   `source` and `name`/`email` are NEVER taken from the request body
 *   when the submitter is logged in — they're derived from the
 *   verified session (req.user) instead. A buggy or malicious client
 *   claiming to be "business" while holding a personal-space token,
 *   or typing someone else's email into a pre-filled field, can't
 *   misattribute a submission this way. Only a genuinely anonymous
 *   request (req.user === null, i.e. the public home page) supplies
 *   its own name/email — and that path is exactly why every
 *   submission still needs its own name/email fields at all.
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError         = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const contactService   = require('../services/contact.service');
const { sendContactSubmissionEmail } = require('../services/email.service');

const CATEGORIES = ['complaint', 'suggestion', 'bug', 'other'];
const MAX_MESSAGE_LENGTH = 5000; // generous for a genuine complaint/suggestion, well short of an abuse payload

/**
 * buildContext
 * Turns the verified session into the human-readable label→value
 * pairs the notification email renders directly (see
 * email.service.js's buildContactSubmissionEmail) — null for an
 * anonymous submission, so the email template can skip the "Account
 * Context" section entirely rather than showing an empty one.
 */
function buildContext(user) {
  if (!user) return null;

  if (user.spaceType === 'personal') {
    return {
      'Space Type':   'Personal Wealth OS',
      'Personal UID': user.personalUid,
      'Identity UID': user.identityUid,
    };
  }

  return {
    'Space Type':    'Business OS',
    'Business Name': user.businessName || null,
    'Business UID':  user.businessUid,
    'Role':          user.role,
  };
}

// ── POST /api/contact ────────────────────────────────────────────
const submit = asyncHandler(async (req, res) => {
  const body = sanitise(req.body, ['category', 'message', 'name', 'email']);
  requireFields(body, ['category', 'message']);

  if (!CATEGORIES.includes(body.category)) {
    throw ApiError.badRequest(`Invalid category: "${body.category}".`);
  }

  const message = body.message.trim();
  if (!message) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw ApiError.badRequest(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
  }

  // Logged in (Business OS or Personal Wealth OS): source, name and
  // email all come from the verified session — see this file's
  // header for why the client's own values are never trusted here.
  // Anonymous (home page): the client must supply both.
  let source, name, email;
  if (req.user) {
    source = req.user.spaceType; // 'business' | 'personal'
    name   = req.user.fullName || req.user.nickname || 'BusinessRun User';
    email  = req.user.email;
  } else {
    source = 'home';
    requireFields(body, ['name', 'email']);
    name  = body.name.trim();
    email = body.email.trim().toLowerCase();
    if (!name) {
      throw ApiError.badRequest('Name is required.');
    }
    if (!isValidEmail(email)) {
      throw ApiError.badRequest('Invalid email address.');
    }
  }

  const context = buildContext(req.user);

  const submission = await contactService.createSubmission({
    source, category: body.category, message, name, email, context,
  });

  // The DB write above is the source of truth for this submission —
  // it already succeeded by this point. The notification email is a
  // convenience on top of that, so its failure must never fail (or
  // roll back) a submission the person already successfully made.
  try {
    await sendContactSubmissionEmail({
      submissionId: submission.submissionId,
      source, category: body.category, message, name, email, context,
    });
  } catch (err) {
    console.error('[Contact] Failed to send notification email for submission', submission.submissionId, ':', err.message);
  }

  res.status(201).json({ success: true, submissionId: submission.submissionId });
});

module.exports = { submit };
