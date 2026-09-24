/**
 * controllers/under30.controller.js
 *
 * Handles Under30Women mentorship applications.
 *
 * Route:
 *   POST /api/under30
 */

'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiError        = require('../utils/ApiError');
const { sanitise, requireFields, isValidEmail } = require('../utils/sanitise');
const firebaseService = require('../services/db.service');

// ── POST /api/under30 ─────────────────────────────────────────────
const submitApplication = asyncHandler(async (req, res) => {
  // Sanitise — only allow known fields through
  const body = sanitise(req.body, [
    'fullName',
    'email',
    'phone',
    'age',
    'state',
    'businessName',
    'businessStage',
    'industry',
    'businessDescription',
    'challenge',
    'mentorshipGoal',
    'hearAboutUs',
    'socialHandle',
    'submittedAt',
    'source',
  ]);

  requireFields(body, [
    'fullName',
    'email',
    'businessName',
    'businessDescription',
  ]);

  if (!isValidEmail(body.email)) {
    throw ApiError.badRequest('Invalid email address.');
  }

  if (body.fullName.trim().length < 2) {
    throw ApiError.badRequest('Full name must be at least 2 characters.');
  }

  if (body.businessDescription.trim().length < 20) {
    throw ApiError.badRequest(
      'Business description is too short. Please provide more detail.'
    );
  }

  const { id } = await firebaseService.createUnder30Application({
    fullName:            body.fullName.trim(),
    email:               body.email.toLowerCase().trim(),
    phone:               body.phone?.trim()               || '',
    age:                 body.age                         || '',
    state:               body.state?.trim()               || '',
    businessName:        body.businessName.trim(),
    businessStage:       body.businessStage               || '',
    industry:            body.industry                    || '',
    businessDescription: body.businessDescription.trim(),
    challenge:           body.challenge?.trim()           || '',
    mentorshipGoal:      body.mentorshipGoal?.trim()      || '',
    hearAboutUs:         body.hearAboutUs?.trim()         || '',
    socialHandle:        body.socialHandle?.trim()        || '',
    source:              body.source || 'businessrun-under30',
  });

  res.status(201).json({ success: true, id });
});

module.exports = { submitApplication };
